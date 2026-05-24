import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create warehouses
  const warehouseDelhi = await prisma.warehouse.upsert({
    where: { id: 'wh-delhi-001' },
    update: {},
    create: {
      id: 'wh-delhi-001',
      name: 'Delhi Central Warehouse',
      location: 'New Delhi, India',
    },
  })

  const warehouseMumbai = await prisma.warehouse.upsert({
    where: { id: 'wh-mumbai-001' },
    update: {},
    create: {
      id: 'wh-mumbai-001',
      name: 'Mumbai Fulfillment Hub',
      location: 'Mumbai, India',
    },
  })

  const warehouseBangalore = await prisma.warehouse.upsert({
    where: { id: 'wh-bangalore-001' },
    update: {},
    create: {
      id: 'wh-bangalore-001',
      name: 'Bangalore Tech Hub',
      location: 'Bangalore, India',
    },
  })

  console.log('✅ Warehouses created')

  // Create products
  const products = [
    {
      id: 'prod-001',
      name: 'Sony WH-1000XM5 Headphones',
      description: 'Industry-leading noise cancelling wireless headphones with exceptional sound quality and up to 30 hours battery life.',
      sku: 'SONY-WH1000XM5-BLK',
      price: 34999,
      imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800',
    },
    {
      id: 'prod-002',
      name: 'Apple AirPods Pro (2nd Gen)',
      description: 'Active Noise Cancellation, Transparency mode, Adaptive Audio, and Personalized Spatial Audio with dynamic head tracking.',
      sku: 'APPLE-AIRPODSPRO2-WHT',
      price: 24900,
      imageUrl: 'https://images.unsplash.com/photo-1606841837239-c5a1a4a07af7?w=800',
    },
    {
      id: 'prod-003',
      name: 'Samsung Galaxy Watch 6',
      description: 'Advanced health monitoring, enhanced sleep tracking, and a sleek design. Compatible with Android.',
      sku: 'SAMSUNG-GW6-44MM-BLK',
      price: 28999,
      imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800',
    },
    {
      id: 'prod-004',
      name: 'Logitech MX Master 3S',
      description: 'Advanced wireless mouse with ultra-fast MagSpeed scroll, 8K DPI sensor, and whisper-quiet clicks.',
      sku: 'LOGI-MXMASTER3S-GRY',
      price: 9995,
      imageUrl: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800',
    },
    {
      id: 'prod-005',
      name: 'iPad Air M2',
      description: 'Supercharged by the M2 chip with an 11-inch Liquid Retina display and Apple Pencil Pro support.',
      sku: 'APPLE-IPADAIRM2-256-BLU',
      price: 74900,
      imageUrl: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800',
    },
    {
      id: 'prod-006',
      name: 'GoPro HERO12 Black',
      description: 'Capture stunning 5.3K video and 27MP photos with HyperSmooth 6.0 stabilization.',
      sku: 'GOPRO-HERO12-BLK',
      price: 39500,
      imageUrl: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800',
    },
  ]

  for (const productData of products) {
    await prisma.product.upsert({
      where: { id: productData.id },
      update: {},
      create: {
        id: productData.id,
        name: productData.name,
        description: productData.description,
        sku: productData.sku,
        price: productData.price,
        imageUrl: productData.imageUrl,
      },
    })
  }

  console.log('✅ Products created')

  // Create stock levels
  const stockData = [
    { productId: 'prod-001', warehouseId: 'wh-delhi-001', totalUnits: 15, reservedUnits: 0 },
    { productId: 'prod-001', warehouseId: 'wh-mumbai-001', totalUnits: 8, reservedUnits: 0 },
    { productId: 'prod-001', warehouseId: 'wh-bangalore-001', totalUnits: 3, reservedUnits: 0 },
    { productId: 'prod-002', warehouseId: 'wh-delhi-001', totalUnits: 20, reservedUnits: 0 },
    { productId: 'prod-002', warehouseId: 'wh-mumbai-001', totalUnits: 12, reservedUnits: 0 },
    { productId: 'prod-002', warehouseId: 'wh-bangalore-001', totalUnits: 2, reservedUnits: 0 },
    { productId: 'prod-003', warehouseId: 'wh-delhi-001', totalUnits: 10, reservedUnits: 0 },
    { productId: 'prod-003', warehouseId: 'wh-mumbai-001', totalUnits: 5, reservedUnits: 0 },
    { productId: 'prod-003', warehouseId: 'wh-bangalore-001', totalUnits: 1, reservedUnits: 0 },
    { productId: 'prod-004', warehouseId: 'wh-delhi-001', totalUnits: 25, reservedUnits: 0 },
    { productId: 'prod-004', warehouseId: 'wh-mumbai-001', totalUnits: 18, reservedUnits: 0 },
    { productId: 'prod-004', warehouseId: 'wh-bangalore-001', totalUnits: 7, reservedUnits: 0 },
    { productId: 'prod-005', warehouseId: 'wh-delhi-001', totalUnits: 6, reservedUnits: 0 },
    { productId: 'prod-005', warehouseId: 'wh-mumbai-001', totalUnits: 4, reservedUnits: 0 },
    { productId: 'prod-005', warehouseId: 'wh-bangalore-001', totalUnits: 1, reservedUnits: 0 },
    { productId: 'prod-006', warehouseId: 'wh-delhi-001', totalUnits: 9, reservedUnits: 0 },
    { productId: 'prod-006', warehouseId: 'wh-mumbai-001', totalUnits: 3, reservedUnits: 0 },
    { productId: 'prod-006', warehouseId: 'wh-bangalore-001', totalUnits: 2, reservedUnits: 0 },
  ]

  for (const stock of stockData) {
    await prisma.stockLevel.upsert({
      where: {
        productId_warehouseId: {
          productId: stock.productId,
          warehouseId: stock.warehouseId,
        },
      },
      update: { totalUnits: stock.totalUnits, reservedUnits: stock.reservedUnits },
      create: stock,
    })
  }

  console.log('✅ Stock levels created')
  console.log('🎉 Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
