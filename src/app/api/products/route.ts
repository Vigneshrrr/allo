import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { releaseExpiredReservations } from '@/lib/cleanup'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Lazy cleanup: release expired reservations first so stock counts are accurate
    await releaseExpiredReservations()

    const products = await prisma.product.findMany({
      include: {
        stockLevels: {
          include: {
            warehouse: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    const result = products.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      sku: product.sku,
      price: Number(product.price),
      imageUrl: product.imageUrl,
      stockByWarehouse: product.stockLevels.map((sl) => ({
        warehouseId: sl.warehouseId,
        warehouseName: sl.warehouse.name,
        warehouseLocation: sl.warehouse.location,
        totalUnits: sl.totalUnits,
        reservedUnits: sl.reservedUnits,
        availableUnits: sl.totalUnits - sl.reservedUnits,
      })),
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/products error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
