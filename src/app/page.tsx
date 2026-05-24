'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

interface WarehouseStock {
  warehouseId: string
  warehouseName: string
  warehouseLocation: string
  totalUnits: number
  reservedUnits: number
  availableUnits: number
}

interface Product {
  id: string
  name: string
  description: string
  sku: string
  price: number
  imageUrl: string
  stockByWarehouse: WarehouseStock[]
}

export default function ProductsPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Selected warehouse and quantity for reservation per product id
  const [selections, setSelections] = useState<Record<string, { warehouseId: string; quantity: number }>>({})
  const [reservingId, setReservingId] = useState<string | null>(null)
  const [reserveError, setReserveError] = useState<{ productId: string; message: string } | null>(null)

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products')
      if (!res.ok) throw new Error('Failed to load products')
      const data = await res.json()
      setProducts(data)

      // Initialize default selections: first warehouse with available stock, quantity 1
      const initialSelections: Record<string, { warehouseId: string; quantity: number }> = {}
      data.forEach((p: Product) => {
        const availableWh = p.stockByWarehouse.find(wh => wh.availableUnits > 0) || p.stockByWarehouse[0]
        initialSelections[p.id] = {
          warehouseId: availableWh ? availableWh.warehouseId : '',
          quantity: 1
        }
      })
      setSelections(initialSelections)
      setError(null)
    } catch (err) {
      console.error(err)
      setError('Could not connect to the inventory service. Please check your database connection.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  const handleWarehouseChange = (productId: string, warehouseId: string) => {
    setSelections(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        warehouseId
      }
    }))
    setReserveError(null)
  }

  const handleQuantityChange = (productId: string, quantity: number) => {
    setSelections(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        quantity
      }
    }))
    setReserveError(null)
  }

  const handleReserve = async (product: Product) => {
    const selection = selections[product.id]
    if (!selection || !selection.warehouseId) return

    setReservingId(product.id)
    setReserveError(null)

    // Generate random Idempotency-Key
    const idempotencyKey = crypto.randomUUID()

    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({
          productId: product.id,
          warehouseId: selection.warehouseId,
          quantity: selection.quantity
        })
      })

      const data = await response.json()

      if (response.status === 409) {
        // Not enough stock error (visible to user - requirement 3)
        setReserveError({
          productId: product.id,
          message: data.message || 'Not enough stock available at this warehouse!'
        })
        // Refresh products to show updated stock level
        await fetchProducts()
        return
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to make reservation')
      }

      // Success: Redirect to checkout/reservation page
      router.push(`/reservation/${data.id}`)
    } catch (err: any) {
      setReserveError({
        productId: product.id,
        message: err.message || 'An error occurred during reservation.'
      })
    } finally {
      setReservingId(null)
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex flex-col gap-4 mb-10">
          <div className="skeleton h-10 w-64"></div>
          <div className="skeleton h-5 w-96"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-6 flex flex-col gap-4">
              <div className="skeleton h-48 w-full"></div>
              <div className="skeleton h-6 w-3/4"></div>
              <div className="skeleton h-4 w-1/2"></div>
              <div className="skeleton h-12 w-full mt-4"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 text-center flex flex-col items-center gap-6">
        <div className="alert alert-error max-w-xl text-left">
          <div>
            <strong className="block text-lg mb-1">Database Connection Required</strong>
            {error}
          </div>
        </div>
        <button className="btn-primary" onClick={fetchProducts}>
          Retry Connection
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 fade-in-up">
      <div className="mb-12">
        <h1 className="text-4xl font-extrabold tracking-tight mb-3">
          Multi-Warehouse Catalog
        </h1>
        <p className="text-lg text-[var(--text-secondary)]">
          Real-time stock reservation prevents race conditions and ensures transaction safety.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {products.map(product => {
          const selection = selections[product.id] || { warehouseId: '', quantity: 1 }
          const selectedWhStock = product.stockByWarehouse.find(wh => wh.warehouseId === selection.warehouseId)
          const availableUnits = selectedWhStock ? selectedWhStock.availableUnits : 0
          const totalUnits = selectedWhStock ? selectedWhStock.totalUnits : 0

          return (
            <div key={product.id} className="card overflow-hidden flex flex-col h-full">
              {/* Product Image */}
              <div className="relative h-48 w-full bg-[#1e1e2d] overflow-hidden">
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  style={{ objectFit: 'cover' }}
                  priority={product.id === 'prod-001'}
                />
                <div className="absolute top-3 right-3">
                  <span className="badge badge-pending font-bold backdrop-blur-md">
                    {product.sku}
                  </span>
                </div>
              </div>

              {/* Product Info */}
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex justify-between items-start gap-4 mb-2">
                  <h3 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
                    {product.name}
                  </h3>
                  <span className="text-lg font-bold text-[var(--accent-light)]">
                    ₹{product.price.toLocaleString('en-IN')}
                  </span>
                </div>
                <p className="text-sm text-[var(--text-secondary)] mb-6 flex-grow">
                  {product.description}
                </p>

                {/* Warehouse Stock breakdown */}
                <div className="bg-[#0f0f18] border border-[var(--border)] rounded-xl p-4 mb-6">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] block mb-3">
                    Warehouse Inventory Breakdown
                  </span>
                  <div className="flex flex-col gap-2">
                    {product.stockByWarehouse.map(wh => {
                      const isLowStock = wh.availableUnits > 0 && wh.availableUnits <= 5
                      const isOutOfStock = wh.availableUnits <= 0
                      
                      return (
                        <div key={wh.warehouseId} className="flex items-center justify-between text-sm py-1 border-b border-dashed border-slate-800 last:border-b-0">
                          <span className="text-slate-400 font-medium">{wh.warehouseName}</span>
                          <div className="flex items-center gap-2">
                            {isOutOfStock ? (
                              <span className="badge badge-danger">Out of Stock</span>
                            ) : isLowStock ? (
                              <span className="badge badge-warning">{wh.availableUnits} left</span>
                            ) : (
                              <span className="badge badge-success">{wh.availableUnits} avail</span>
                            )}
                            <span className="text-[10px] text-slate-500">
                              (Total: {wh.totalUnits})
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Reservation controls */}
                <div className="flex flex-col gap-4 mt-auto">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Warehouse Select */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                        Warehouse
                      </label>
                      <select
                        className="bg-[#1c1c28] border border-[var(--border)] rounded-lg text-sm px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                        value={selection.warehouseId}
                        onChange={(e) => handleWarehouseChange(product.id, e.target.value)}
                      >
                        {product.stockByWarehouse.map(wh => (
                          <option key={wh.warehouseId} value={wh.warehouseId}>
                            {wh.warehouseName.replace(' Warehouse', '').replace(' Fulfillment Hub', '')}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity Selector */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                        Quantity
                      </label>
                      <select
                        className="bg-[#1c1c28] border border-[var(--border)] rounded-lg text-sm px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                        value={selection.quantity}
                        onChange={(e) => handleQuantityChange(product.id, parseInt(e.target.value))}
                        disabled={availableUnits <= 0}
                      >
                        {Array.from({ length: Math.min(10, Math.max(1, availableUnits)) }, (_, i) => i + 1).map(num => (
                          <option key={num} value={num}>
                            {num} unit{num > 1 ? 's' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 409 / Reserve Error Banner */}
                  {reserveError && reserveError.productId === product.id && (
                    <div className="alert alert-error text-xs py-2 px-3 mt-1">
                      {reserveError.message}
                    </div>
                  )}

                  {/* Reserve Button */}
                  <button
                    className="btn-primary flex items-center justify-center gap-2 py-3 mt-2"
                    onClick={() => handleReserve(product)}
                    disabled={availableUnits <= 0 || reservingId === product.id}
                  >
                    {reservingId === product.id ? (
                      <>
                        <span className="spinner" />
                        Holding Units...
                      </>
                    ) : availableUnits <= 0 ? (
                      'Out of Stock'
                    ) : (
                      'Reserve for Checkout'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
