import crypto from 'crypto'

async function runConcurrencyTest() {
  const baseUrl = 'http://localhost:3000'
  console.log('🚀 Starting Concurrency Validation Test against', baseUrl)

  try {
    // 1. Fetch products catalog to find a product with available stock
    const productsRes = await fetch(`${baseUrl}/api/products`)
    if (!productsRes.ok) {
      throw new Error(`Failed to fetch catalog: ${productsRes.status}`)
    }
    const products = await productsRes.json()

    // Find a product and warehouse with at least 1 unit available
    let targetProduct: any = null
    let targetWarehouse: any = null

    for (const p of products) {
      const wh = p.stockByWarehouse.find((w: any) => w.availableUnits > 0)
      if (wh) {
        targetProduct = p
        targetWarehouse = wh
        break
      }
    }

    if (!targetProduct || !targetWarehouse) {
      console.error('❌ No products with available stock found in catalog to test!')
      return
    }

    console.log(`🎯 Target product: "${targetProduct.name}" (SKU: ${targetProduct.sku})`)
    console.log(`🎯 Target warehouse: "${targetWarehouse.warehouseName}" (Available stock: ${targetWarehouse.availableUnits})`)

    // We will attempt to reserve the last unit of stock using 10 concurrent requests
    const quantityToReserve = 1
    const totalRequests = 10
    console.log(`🔥 Launching ${totalRequests} concurrent reservation requests for quantity = ${quantityToReserve} unit...`)

    const requests = Array.from({ length: totalRequests }).map(async (_, idx) => {
      // Generate a unique idempotency key for each unique client thread
      const idempotencyKey = crypto.randomUUID()
      
      try {
        const response = await fetch(`${baseUrl}/api/reservations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify({
            productId: targetProduct.id,
            warehouseId: targetWarehouse.warehouseId,
            quantity: quantityToReserve,
          }),
        })

        const status = response.status
        const body = await response.json()
        return { success: response.ok, status, body, idx }
      } catch (err: any) {
        return { success: false, status: 500, error: err.message, idx }
      }
    })

    const results = await Promise.all(requests)

    // 3. Process results
    const successes = results.filter((r) => r.status === 201)
    const conflicts = results.filter((r) => r.status === 409)
    const errors = results.filter((r) => r.status !== 201 && r.status !== 409)

    console.log('\n📊 Concurrency Test Summary:')
    console.log(`✅ Successes (201 Created): ${successes.length}`)
    console.log(`🔒 Conflicts (409 Conflict): ${conflicts.length}`)
    if (errors.length > 0) {
      console.log(`⚠️ Other statuses/Errors: ${errors.length}`)
      errors.forEach(e => console.log(`   - Thread ${e.idx}: Status ${e.status}`, (e as any).body || (e as any).error))
    }

    // Assert that the sum of successes matches the available stock
    // (If availableUnits was 1, exactly 1 request should succeed. If 2, then up to 2, etc.)
    const expectedSuccesses = Math.min(targetWarehouse.availableUnits, totalRequests)
    
    console.log('\n⚖️ Validation Checks:')
    if (successes.length === expectedSuccesses) {
      console.log(`🟢 PASS: Exactly ${successes.length} reservation(s) succeeded!`)
    } else {
      console.log(`🔴 FAIL: Expected ${expectedSuccesses} successes, but got ${successes.length}`)
    }

    if (conflicts.length === (totalRequests - expectedSuccesses)) {
      console.log(`🟢 PASS: Exactly ${conflicts.length} conflict(s) (409) were returned!`)
    } else {
      console.log(`🔴 FAIL: Expected ${totalRequests - expectedSuccesses} conflicts, but got ${conflicts.length}`)
    }

    if (successes.length === expectedSuccesses && conflicts.length === (totalRequests - expectedSuccesses)) {
      console.log('\n👑 CONCURRENCY TEST RESULT: SUCCESS! The system is race-condition-free.')
    } else {
      console.log('\n❌ CONCURRENCY TEST RESULT: FAILED!')
    }

  } catch (error: any) {
    console.error('❌ Error executing concurrency test:', error.message)
  }
}

runConcurrencyTest()
