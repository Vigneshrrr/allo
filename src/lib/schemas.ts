import { z } from 'zod'

export const ReserveSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  warehouseId: z.string().uuid('Invalid warehouse ID'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(100, 'Quantity cannot exceed 100'),
})

export const ConfirmSchema = z.object({
  id: z.string().uuid('Invalid reservation ID'),
})

export const ReleaseSchema = z.object({
  id: z.string().uuid('Invalid reservation ID'),
})

export type ReserveInput = z.infer<typeof ReserveSchema>

export const RESERVATION_EXPIRY_MINUTES = 10
