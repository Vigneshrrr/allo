import { getPrisma } from './prisma';

/**
 * Lazy cleanup: release all expired PENDING reservations and decrement reservedUnits.
 * Called at the start of product reads to ensure accurate available stock.
 */
export async function releaseExpiredReservations(): Promise<number> {
  const prisma = getPrisma();
  const now = new Date();

  // Find all expired pending reservations
  const expired = await prisma.reservation.findMany({
    where: {
      status: 'PENDING',
      expiresAt: { lt: now },
    },
  });

  if (expired.length === 0) return 0;

  // Release each in a transaction
  await prisma.$transaction(async (tx) => {
    for (const reservation of expired) {
      await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: 'RELEASED' },
      });

      await tx.stockLevel.update({
        where: {
          productId_warehouseId: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
        },
        data: {
          reservedUnits: { decrement: reservation.quantity },
        },
      });
    }
  });

  return expired.length;
}
