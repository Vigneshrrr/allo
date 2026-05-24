import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// --- Background Active Reservation Expiry Worker ---
if (typeof window === 'undefined') {
  const globalAny = globalThis as any
  if (!globalAny.cleanupIntervalStarted) {
    globalAny.cleanupIntervalStarted = true
    console.log('⏱️ Background Active Reservation Expiry Worker initialized (10s interval)')
    
    // Run initial cleanup after a short delay
    setTimeout(async () => {
      try {
        const { releaseExpiredReservations } = await import('./cleanup')
        await releaseExpiredReservations()
      } catch (err) {
        console.error('Initial background cleanup error:', err)
      }
    }, 2000)

    // Schedule periodic cleanup every 10 seconds
    setInterval(async () => {
      try {
        const { releaseExpiredReservations } = await import('./cleanup')
        const count = await releaseExpiredReservations()
        if (count > 0) {
          console.log(`⏱️ Background Expiry Worker: auto-released ${count} expired reservation(s)`)
        }
      } catch (err) {
        console.error('Active background cleanup error:', err)
      }
    }, 10000)
  }
}
