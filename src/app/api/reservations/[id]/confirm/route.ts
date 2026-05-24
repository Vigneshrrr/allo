import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const idempotencyKey = request.headers.get('Idempotency-Key')

    // --- Idempotency check ---
    if (idempotencyKey) {
      const existing = await prisma.idempotencyRecord.findUnique({
        where: { key: `confirm:${idempotencyKey}` },
      })
      if (existing) {
        return NextResponse.json(JSON.parse(existing.responseBody), {
          status: existing.responseStatus,
          headers: { 'X-Idempotent-Replay': 'true' },
        })
      }
    }

    const isPostgres = process.env.DATABASE_URL?.startsWith('postgres') || process.env.DATABASE_URL?.startsWith('db')
    const now = new Date()
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
            expires_at: Date
            product_id: string
            warehouse_id: string
            quantity: number
          }>
        >`
          SELECT id, status, "expiresAt" as expires_at, "productId" as product_id,
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
          expires_at: r.expiresAt,
          product_id: r.productId,
          warehouse_id: r.warehouseId,
          quantity: r.quantity
        }
      }

      if (reservation.status !== 'PENDING') {
        responseStatus = 400
        responseBody = {
          error: 'Reservation is not pending',
          status: reservation.status,
        }
        return
      }

      // Check expiry
      if (reservation.expires_at < now) {
        // Release the hold - reservation has expired
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

        responseStatus = 410
        responseBody = {
          error: 'Reservation has expired',
          message: 'Your reservation window has closed. Please start a new reservation.',
          expiredAt: reservation.expires_at.toISOString(),
        }
        return
      }

      // Confirm: decrement both reservedUnits and totalUnits (permanently consumed)
      await tx.reservation.update({
        where: { id },
        data: { status: 'CONFIRMED' },
      })
      await tx.stockLevel.update({
        where: {
          productId_warehouseId: {
            productId: reservation.product_id,
            warehouseId: reservation.warehouse_id,
          },
        },
        data: {
          reservedUnits: { decrement: reservation.quantity },
          totalUnits: { decrement: reservation.quantity },
        },
      })

      responseStatus = 200
      responseBody = {
        id,
        status: 'CONFIRMED',
        message: 'Reservation confirmed. Payment successful!',
      }
    })

    // Cache idempotency result
    if (idempotencyKey) {
      await prisma.idempotencyRecord.upsert({
        where: { key: `confirm:${idempotencyKey}` },
        update: {},
        create: {
          key: `confirm:${idempotencyKey}`,
          responseStatus: responseStatus!,
          responseBody: JSON.stringify(responseBody!),
        },
      })
    }

    return NextResponse.json(responseBody!, { status: responseStatus! })
  } catch (error) {
    console.error('POST /api/reservations/[id]/confirm error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
