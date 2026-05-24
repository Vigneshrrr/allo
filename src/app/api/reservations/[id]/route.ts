import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        product: true,
        warehouse: true,
      },
    })

    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
    }

    const now = new Date()

    const isPostgres = process.env.DATABASE_URL?.startsWith('postgres') || process.env.DATABASE_URL?.startsWith('db')

    // Lazy cleanup for this specific reservation if requested and it has expired
    if (reservation.status === 'PENDING' && reservation.expiresAt < now) {
      // Release reservation
      const updated = await prisma.$transaction(async (tx) => {
        let isStillPending = false

        if (isPostgres) {
          // Lock and double check status in Postgres
          const rows = await tx.$queryRaw<
            Array<{ id: string; status: string; expiresAt: Date }>
          >`
            SELECT id, status, "expiresAt" FROM "Reservation" WHERE id = ${id} FOR UPDATE
          `
          isStillPending = rows.length > 0 && rows[0].status === 'PENDING'
        } else {
          // Fallback for SQLite
          const r = await tx.reservation.findUnique({
            where: { id }
          })
          isStillPending = r !== null && r.status === 'PENDING'
        }

        if (isStillPending) {
          await tx.reservation.update({
            where: { id },
            data: { status: 'RELEASED' },
          })
          await tx.stockLevel.update({
            where: {
              productId_warehouseId: {
                productId: reservation.productId,
                warehouseId: reservation.warehouseId,
              },
            },
            data: { reservedUnits: { decrement: reservation.quantity } },
          })
          return 'RELEASED'
        }
        return reservation.status
      })

      reservation.status = updated as any
    }

    const responseBody = {
      id: reservation.id,
      productId: reservation.productId,
      productName: reservation.product.name,
      productSku: reservation.product.sku,
      productPrice: Number(reservation.product.price),
      productImageUrl: reservation.product.imageUrl,
      warehouseId: reservation.warehouseId,
      warehouseName: reservation.warehouse.name,
      quantity: reservation.quantity,
      status: reservation.status,
      expiresAt: reservation.expiresAt.toISOString(),
      createdAt: reservation.createdAt.toISOString(),
    }

    return NextResponse.json(responseBody)
  } catch (error) {
    console.error('GET /api/reservations/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
