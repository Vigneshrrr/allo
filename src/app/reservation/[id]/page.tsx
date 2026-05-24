'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

interface Reservation {
  id: string
  productId: string
  productName: string
  productSku: string
  productPrice: number
  productImageUrl: string
  warehouseId: string
  warehouseName: string
  quantity: number
  status: 'PENDING' | 'CONFIRMED' | 'RELEASED'
  expiresAt: string
  createdAt: string
}

export default function ReservationPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)

  const [reservation, setReservation] = useState<Reservation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Timer state
  const [timeLeft, setTimeLeft] = useState<number>(0) // in seconds
  const [timerExpired, setTimerExpired] = useState(false)
  const [isCritical, setIsCritical] = useState(false)

  // Transaction states
  const [confirming, setConfirming] = useState(false)
  const [releasing, setReleasing] = useState(false)

  const fetchReservation = async () => {
    try {
      // We check our products API or a specific reservation endpoint
      // We can use a GET on the reservation or retrieve it from products.
      // But we don't have a direct GET /api/reservations/:id endpoint in requirements.
      // However, we can fetch all products or write a small get reservation API if needed.
      // Wait, let's write a GET /api/reservations/:id API route as well to make this extremely robust!
      const res = await fetch(`/api/reservations/${id}`)
      if (!res.ok) {
        if (res.status === 404) throw new Error('Reservation not found')
        throw new Error('Failed to load reservation details')
      }
      const data = await res.json()
      setReservation(data)
      
      if (data.status === 'PENDING') {
        const expiry = new Date(data.expiresAt).getTime()
        const now = new Date().getTime()
        const diff = Math.max(0, Math.floor((expiry - now) / 1000))
        setTimeLeft(diff)
        if (diff <= 0) {
          setTimerExpired(true)
        }
        if (diff > 0 && diff < 120) {
          setIsCritical(true)
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while loading checkout.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReservation()
  }, [id])

  // Countdown timer effect
  useEffect(() => {
    if (!reservation || reservation.status !== 'PENDING' || timeLeft <= 0) return

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        const nextValue = prev - 1
        if (nextValue <= 0) {
          clearInterval(interval)
          setTimerExpired(true)
          // Lazily update state to RELEASED
          setReservation(curr => curr ? { ...curr, status: 'RELEASED' } : null)
          return 0
        }
        if (nextValue < 120) {
          setIsCritical(true)
        }
        return nextValue
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [reservation, timeLeft])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleConfirm = async () => {
    if (!reservation) return
    setConfirming(true)
    setError(null)

    // Generate random Idempotency-Key
    const idempotencyKey = crypto.randomUUID()

    try {
      const res = await fetch(`/api/reservations/${reservation.id}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        }
      })

      const data = await res.json()

      if (res.status === 410) {
        // Reservation expired (visible to user - requirement 3)
        setError('410: Reservation Expired! The stock has been released to other shoppers.')
        setReservation(curr => curr ? { ...curr, status: 'RELEASED' } : null)
        setTimerExpired(true)
        return
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to confirm purchase')
      }

      // Success - State updated dynamically without refresh
      setReservation(curr => curr ? { ...curr, status: 'CONFIRMED' } : null)
    } catch (err: any) {
      setError(err.message || 'Payment confirmation failed.')
    } finally {
      setConfirming(false)
    }
  }

  const handleCancel = async () => {
    if (!reservation) return
    setReleasing(true)
    setError(null)

    try {
      const res = await fetch(`/api/reservations/${reservation.id}/release`, {
        method: 'POST'
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to release reservation')
      }

      // Success - State updated dynamically without refresh
      setReservation(curr => curr ? { ...curr, status: 'RELEASED' } : null)
    } catch (err: any) {
      setError(err.message || 'Could not cancel reservation.')
    } finally {
      setReleasing(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 flex flex-col gap-6 items-center">
        <div className="skeleton h-12 w-1/3"></div>
        <div className="skeleton h-64 w-full mt-4"></div>
      </div>
    )
  }

  if (error && !reservation) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center flex flex-col items-center gap-6">
        <div className="alert alert-error text-left w-full">
          <div>
            <strong className="block text-lg mb-1">Error Loading Checkout</strong>
            {error}
          </div>
        </div>
        <Link href="/" className="btn-primary mt-4">
          Return to Catalog
        </Link>
      </div>
    )
  }

  if (!reservation) return null

  const isPending = reservation.status === 'PENDING'
  const isConfirmed = reservation.status === 'CONFIRMED'
  const isReleased = reservation.status === 'RELEASED'

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 fade-in-up">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/" className="text-sm font-semibold text-[var(--accent-light)] hover:underline flex items-center gap-1.5">
          ← Catalog
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Reservation Info & Actions */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="card p-8 flex flex-col gap-6">
            <div className="flex justify-between items-start gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] block mb-1">
                  Checkout Hold
                </span>
                <h1 className="text-3xl font-extrabold tracking-tight">
                  Secure Checkout
                </h1>
              </div>

              {isPending && (
                <span className="badge badge-pending font-bold py-1.5 px-3">
                  Hold Pending
                </span>
              )}
              {isConfirmed && (
                <span className="badge badge-success font-bold py-1.5 px-3">
                  Confirmed
                </span>
              )}
              {isReleased && (
                <span className="badge badge-danger font-bold py-1.5 px-3">
                  Hold Released
                </span>
              )}
            </div>

            {/* Error alerts */}
            {error && (
              <div className="alert alert-error text-sm">
                {error}
              </div>
            )}

            {/* Hold Banner details */}
            {isPending && (
              <div className="bg-[#0f0f18] border border-[var(--border)] rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <strong className="block text-sm text-[var(--text-primary)] mb-1">
                    Temporary Inventory Reservation
                  </strong>
                  <span className="text-xs text-[var(--text-secondary)]">
                    We are holding these items exclusively for you. Pay before the timer runs out to secure stock.
                  </span>
                </div>
                {/* Visual live timer */}
                <div className={`flex flex-col items-center justify-center min-w-[100px] h-[100px] rounded-2xl bg-[#1c1c28] border ${isCritical ? 'border-[var(--danger)] countdown-critical' : 'border-[var(--accent)]'} px-4 py-2`}>
                  <span className={`text-2xl font-black ${isCritical ? 'text-[var(--danger)]' : 'text-[var(--accent-light)]'}`}>
                    {formatTime(timeLeft)}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-slate-400 mt-1">
                    Time Left
                  </span>
                </div>
              </div>
            )}

            {isConfirmed && (
              <div className="alert alert-success">
                <div>
                  <strong className="block text-base mb-1">Fulfillment Confirmed!</strong>
                  Your order is verified. Your physical stock has been permanently decremented from <strong>{reservation.warehouseName}</strong>.
                </div>
              </div>
            )}

            {isReleased && (
              <div className="alert alert-warning">
                <div>
                  <strong className="block text-base mb-1">Reservation Released</strong>
                  Your reservation window has ended or the reservation was cancelled. The items have been returned to open inventory.
                </div>
              </div>
            )}

            {/* Product breakdown */}
            <div className="flex gap-4 p-4 bg-[#14141d] rounded-xl border border-[var(--border)]">
              <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-[#1e1e2d] flex-shrink-0">
                <Image
                  src={reservation.productImageUrl}
                  alt={reservation.productName}
                  fill
                  style={{ objectFit: 'cover' }}
                />
              </div>
              <div className="flex-grow">
                <span className="text-[11px] font-bold text-slate-500 block uppercase mb-1">
                  SKU: {reservation.productSku}
                </span>
                <h4 className="font-bold text-[var(--text-primary)] mb-1">
                  {reservation.productName}
                </h4>
                <div className="text-sm text-[var(--text-secondary)]">
                  Warehouse: <span className="text-[var(--text-primary)] font-medium">{reservation.warehouseName}</span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            {isPending && (
              <div className="flex flex-col sm:flex-row gap-4 mt-2">
                <button
                  className="btn-success flex-grow flex items-center justify-center gap-2 py-3.5"
                  onClick={handleConfirm}
                  disabled={confirming || releasing}
                >
                  {confirming ? (
                    <>
                      <span className="spinner" />
                      Authorizing Payment...
                    </>
                  ) : (
                    'Confirm Purchase'
                  )}
                </button>
                <button
                  className="btn-danger sm:w-1/3 flex items-center justify-center gap-2 py-3.5"
                  onClick={handleCancel}
                  disabled={confirming || releasing}
                >
                  {releasing ? <span className="spinner" /> : 'Cancel Hold'}
                </button>
              </div>
            )}

            {!isPending && (
              <Link href="/" className="btn-primary py-3.5 flex items-center justify-center text-center mt-2">
                Back to Catalog
              </Link>
            )}
          </div>
        </div>

        {/* Right Column: Cost Breakdown & Order details */}
        <div className="flex flex-col gap-6">
          <div className="card p-6 flex flex-col gap-6">
            <h3 className="text-lg font-bold tracking-tight">Order Summary</h3>
            
            <div className="flex flex-col gap-3 text-sm border-b border-slate-800 pb-4">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Unit Price</span>
                <span>₹{reservation.productPrice.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Quantity</span>
                <span className="font-bold">{reservation.quantity} unit{reservation.quantity > 1 ? 's' : ''}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Fulfillment Cost</span>
                <span className="text-[#10b981]">FREE</span>
              </div>
            </div>

            <div className="flex justify-between items-baseline">
              <span className="font-bold">Total Cost</span>
              <span className="text-2xl font-black text-[var(--accent-light)]">
                ₹{(reservation.productPrice * reservation.quantity).toLocaleString('en-IN')}
              </span>
            </div>

            <div className="border-t border-slate-800 pt-4 flex flex-col gap-2.5 text-xs text-[var(--text-secondary)]">
              <div className="flex justify-between">
                <span>Hold ID</span>
                <span className="font-mono text-[var(--text-primary)]">{reservation.id.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between">
                <span>Hold Status</span>
                <span className="capitalize font-semibold text-[var(--text-primary)]">{reservation.status.toLowerCase()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
