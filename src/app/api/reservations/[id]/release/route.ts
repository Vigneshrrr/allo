import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const isPostgres = process.env.DATABASE_URL?.startsWith('postgres') || process.env.DATABASE_URL?.startsWith('db')
    let responseStatus: number
    let responseBody: Record<string, unknown>

    await prisma.$transaction(async (tx) => {
      let reservation

      if (isPostgres) {
        // Lock the reservation row in Postgres
        const rows = await tx.$queryRaw<
          Array<{
            id: string
            status: string
            product_id: string
            warehouse_id: string
            quantity: number
          }>
        >`
          SELECT id, status, "productId" as product_id,
                 "warehouseId" as warehouse_id, quantity
          FROM "Reservation"
          WHERE id = ${id}
          FOR UPDATE
        `

        if (rows.length === 0) {
          responseStatus = 404
          responseBody = { error: 'Reservation not found' }
          return
        }
        reservation = rows[0]
      } else {
        // Fallback for SQLite
        const r = await tx.reservation.findUnique({
          where: { id }
        })

        if (!r) {
          responseStatus = 404
          responseBody = { error: 'Reservation not found' }
          return
        }

        reservation = {
          id: r.id,
          status: r.status,
          product_id: r.productId,
          warehouse_id: r.warehouseId,
          quantity: r.quantity
        }
      }

      if (reservation.status !== 'PENDING') {
        responseStatus = 400
        responseBody = {
          error: 'Only PENDING reservations can be released',
          status: reservation.status,
        }
        return
      }

      // Release: restore reserved units
      await tx.reservation.update({
        where: { id },
        data: { status: 'RELEASED' },
      })
      await tx.stockLevel.update({
        where: {
          productId_warehouseId: {
            productId: reservation.product_id,
            warehouseId: reservation.warehouse_id,
          },
        },
        data: { reservedUnits: { decrement: reservation.quantity } },
      })

      responseStatus = 200
      responseBody = {
        id,
        status: 'RELEASED',
        message: 'Reservation released. Units returned to available stock.',
      }
    })

    return NextResponse.json(responseBody!, { status: responseStatus! })
  } catch (error) {
    console.error('POST /api/reservations/[id]/release error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
