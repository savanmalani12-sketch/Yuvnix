import { z } from 'zod';

export const createSharedRideSchema = z.object({
  destination: z
    .string()
    .min(3, 'Destination must be at least 3 characters')
    .max(100, 'Destination must be 100 characters or fewer'),
  pickup_point: z
    .string()
    .min(3, 'Pickup point must be specified')
    .max(120, 'Pickup point must be 120 characters or fewer'),
  departure_time: z
    .string()
    .min(1, 'Departure date and time are required'),
  total_seats: z
    .number({ invalid_type_error: 'Total seats must be a number' })
    .int('Seats must be an integer')
    .min(1, 'Minimum 1 seat')
    .max(6, 'Maximum 6 seats typically for taxi rides'),
  estimated_cost_per_seat: z
    .number({ invalid_type_error: 'Cost must be a number' })
    .min(0, 'Estimated cost cannot be negative')
    .optional()
    .nullable(),
  luggage_details: z
    .string()
    .max(120, 'Luggage details must be 120 characters or fewer')
    .optional()
    .or(z.literal('')),
  notes: z
    .string()
    .max(200, 'Notes must be 200 characters or fewer')
    .optional()
    .or(z.literal('')),
});

export type CreateSharedRideInput = z.infer<typeof createSharedRideSchema>;

export const joinRideSchema = z.object({
  seats_reserved: z
    .number()
    .int()
    .min(1, 'Must reserve at least 1 seat')
    .max(4, 'Cannot reserve more than 4 seats in a shared taxi'),
  notes: z
    .string()
    .max(150, 'Notes must be 150 characters or fewer')
    .optional()
    .or(z.literal('')),
});

export type JoinRideInput = z.infer<typeof joinRideSchema>;
