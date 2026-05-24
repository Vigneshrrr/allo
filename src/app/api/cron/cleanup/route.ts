import { NextResponse } from 'next/server'
import { releaseExpiredReservations } from '@/lib/cleanup'

export const dynamic = 'force-dynamic'

/**
 * Vercel Cron Job endpoint — called every minute by vercel.json cron config.
 * Releases expired PENDING reservations so units return to available stock.
 */
export async function GET(request: Request) {
  // Protect endpoint with a secret to prevent unauthorized calls
  const authHeader = request.headers.get('authorization')
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const released = await releaseExpiredReservations()
    return NextResponse.json({
      success: true,
      releasedCount: released,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Cron cleanup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
