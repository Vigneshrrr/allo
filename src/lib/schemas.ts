import { z } from 'zod'

export const ReserveSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  warehouseId: z.string().min(1, 'Warehouse ID is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(100, 'Quantity cannot exceed 100'),
})

export const ConfirmSchema = z.object({
  id: z.string().min(1, 'Reservation ID is required'),
})

export const ReleaseSchema = z.object({
  id: z.string().min(1, 'Reservation ID is required'),
})

export type ReserveInput = z.infer<typeof ReserveSchema>

export const RESERVATION_EXPIRY_MINUTES = 10
