import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ReserveSchema, RESERVATION_EXPIRY_MINUTES } from '@/lib/schemas'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const idempotencyKey = request.headers.get('Idempotency-Key')

    // Validate input
    const parsed = ReserveSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { productId, warehouseId, quantity } = parsed.data

    // --- Idempotency check ---
    if (idempotencyKey) {
      const existing = await prisma.idempotencyRecord.findUnique({
        where: { key: idempotencyKey },
      })
      if (existing) {
        return NextResponse.json(JSON.parse(existing.responseBody), {
          status: existing.responseStatus,
          headers: { 'X-Idempotent-Replay': 'true' },
        })
      }
    }

    // --- Concurrency-safe reservation using pessimistic locking ---
    let reservation
    let responseStatus = 201

    try {
      const isPostgres = process.env.DATABASE_URL?.startsWith('postgres') || process.env.DATABASE_URL?.startsWith('db')

      reservation = await prisma.$transaction(async (tx) => {
        let stock
        
        if (isPostgres) {
          // Lock the stock row for this product+warehouse exclusively in Postgres
          const stockRows = await tx.$queryRaw<
            Array<{
              id: string
              total_units: number
              reserved_units: number
            }>
          >`
            SELECT id, "totalUnits" as total_units, "reservedUnits" as reserved_units
            FROM "StockLevel"
            WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId}
            FOR UPDATE
          `

          if (stockRows.length === 0) {
            throw new Error('STOCK_NOT_FOUND')
          }
          stock = stockRows[0]
        } else {
          // Fallback for SQLite (serializes write transactions automatically)
          const s = await tx.stockLevel.findUnique({
            where: {
              productId_warehouseId: { productId, warehouseId }
            }
          })
          if (!s) {
            throw new Error('STOCK_NOT_FOUND')
          }
          stock = {
            id: s.id,
            total_units: s.totalUnits,
            reserved_units: s.reservedUnits
          }
        }

        const available = stock.total_units - stock.reserved_units

        if (available < quantity) {
          throw new Error('INSUFFICIENT_STOCK')
        }

        // Increment reservedUnits
        await tx.stockLevel.update({
          where: { id: stock.id },
          data: { reservedUnits: { increment: quantity } },
        })

        // Create reservation
        const expiresAt = new Date(
          Date.now() + RESERVATION_EXPIRY_MINUTES * 60 * 1000
        )

        const newReservation = await tx.reservation.create({
          data: {
            productId,
            warehouseId,
            quantity,
            status: 'PENDING',
            expiresAt,
            idempotencyKey: idempotencyKey ?? undefined,
          },
          include: {
            product: true,
            warehouse: true,
          },
        })

        return newReservation
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : ''
      if (message === 'INSUFFICIENT_STOCK' || message === 'STOCK_NOT_FOUND') {
        const errBody = {
          error: 'Insufficient stock',
          message: 'Not enough units available for this product at the selected warehouse.',
        }
        if (idempotencyKey) {
          await prisma.idempotencyRecord.upsert({
            where: { key: idempotencyKey },
            update: {},
            create: {
              key: idempotencyKey,
              responseStatus: 409,
              responseBody: JSON.stringify(errBody),
            },
          })
        }
        return NextResponse.json(errBody, { status: 409 })
      }
      throw err
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

    // Cache idempotency response
    if (idempotencyKey) {
      await prisma.idempotencyRecord.upsert({
        where: { key: idempotencyKey },
        update: {},
        create: {
          key: idempotencyKey,
          responseStatus: responseStatus,
          responseBody: JSON.stringify(responseBody),
        },
      })
    }

    return NextResponse.json(responseBody, { status: responseStatus })
  } catch (error) {
    console.error('POST /api/reservations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
