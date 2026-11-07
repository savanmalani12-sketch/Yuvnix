import { z } from 'zod';

export const communityCreationRequestSchema = z.object({
  proposed_name: z
    .string()
    .min(3, 'Community name must be at least 3 characters')
    .max(80, 'Community name must be 80 characters or fewer')
    .regex(
      /^[a-zA-Z0-9\s,.'-–]+$/,
      'Name can only contain letters, numbers, spaces, and punctuation'
    ),
  proposed_type: z.enum(['hostel', 'pg', 'apartment', 'other'], {
    required_error: 'Please select a residential type',
  }),
  // Product rule: College is optional metadata, not the community entity itself
  college_affiliation: z
    .string()
    .max(120, 'College name must be 120 characters or fewer')
    .optional()
    .or(z.literal('')),
  address: z
    .string()
    .min(5, 'Full street address or landmark is required')
    .max(200, 'Address must be 200 characters or fewer'),
  city: z
    .string()
    .min(2, 'City is required')
    .max(60, 'City name too long'),
  // Defaults to the selected map location
  proposed_delivery_pickup_point: z.string().optional(),
  proposed_taxi_pickup_point: z.string().optional(),
});

export type CommunityCreationRequestInput = z.infer<typeof communityCreationRequestSchema>;
