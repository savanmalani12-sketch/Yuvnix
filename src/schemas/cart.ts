import { z } from 'zod';

export const createGroupCartSchema = z.object({
  title: z
    .string()
    .min(3, 'Order title must be at least 3 characters (e.g. Zepto Midnight Snacks)')
    .max(80, 'Title must be 80 characters or fewer'),
  store_name: z
    .string()
    .max(60, 'Store name must be 60 characters or fewer')
    .optional()
    .or(z.literal('')),
  lock_at: z
    .string()
    .min(1, 'Please specify when ordering closes and cart locks'),
  pickup_instructions: z
    .string()
    .max(200, 'Instructions must be 200 characters or fewer')
    .optional()
    .or(z.literal('')),
});

export type CreateGroupCartInput = z.infer<typeof createGroupCartSchema>;

export const addCartItemSchema = z.object({
  item_name: z
    .string()
    .min(2, 'Item name must be at least 2 characters')
    .max(100, 'Item name must be 100 characters or fewer'),
  quantity: z
    .number({ invalid_type_error: 'Quantity must be a number' })
    .int('Quantity must be an integer')
    .min(1, 'Quantity must be at least 1')
    .max(99, 'Quantity must be 99 or fewer'),
  unit_price_estimate: z
    .number({ invalid_type_error: 'Price must be a number' })
    .min(0, 'Price cannot be negative')
    .optional()
    .nullable(),
  notes: z
    .string()
    .max(150, 'Notes must be 150 characters or fewer')
    .optional()
    .or(z.literal('')),
});

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
