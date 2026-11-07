/**
 * Yuvnix Domain Models & Enums
 *
 * Product Rules Enforced:
 * 1. Communities are physical residences (hostel, PG, apartment), NOT colleges.
 * 2. College is optional metadata on a community.
 * 3. Communities require staff approval before going live.
 * 4. No permanent student hierarchy/superiority for requesting.
 * 5. Verified shared delivery & taxi pickup points exist per community.
 * 6. Multi-community membership allowed.
 * 7. Group grocery carts have item lists and associated chat.
 * 8. Shared rides have pickup, destination, departure time, seats, and associated chat.
 * 9. Peer-to-peer settlement; no payment gateway integration in MVP.
 */

export type ResidentialType = 'hostel' | 'pg' | 'apartment' | 'other';

export type UserRole = 'student' | 'support_staff' | 'admin';

export type CommunityRequestStatus = 'pending' | 'approved' | 'rejected';

export type GroupCartStatus = 'open' | 'locked' | 'ordered' | 'completed' | 'cancelled';

export type SharedRideStatus = 'open' | 'full' | 'departed' | 'completed' | 'cancelled';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  username?: string | null;
  avatar_url?: string | null;
  phone_number?: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Community {
  id: string;
  name: string; // e.g. "PDEU Hostel", "PDEU Girls Hostel", "Sunrise PG"
  slug: string;
  description?: string | null;
  type: ResidentialType;
  // Rule: College is optional metadata, not the community entity itself
  college_affiliation?: string | null;
  address: string;
  city: string;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  // Rule: Verified shared delivery and taxi pickup point
  delivery_pickup_point: string;
  taxi_pickup_point: string;
  is_verified: boolean;
  active_member_count: number;
  created_at: string;
  updated_at: string;
}

export interface CommunityMembership {
  id: string;
  community_id: string;
  user_id: string;
  joined_at: string;
  is_active: boolean;
}

export interface CommunityCreationRequest {
  id: string;
  requested_by_user_id: string;
  proposed_name: string;
  proposed_type: ResidentialType;
  college_affiliation?: string | null;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  proposed_delivery_pickup_point: string;
  proposed_taxi_pickup_point: string;
  status: CommunityRequestStatus;
  reviewed_by_staff_id?: string | null;
  review_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GroupCart {
  id: string;
  community_id: string;
  created_by_user_id: string;
  title: string; // e.g. "Zepto Midnight Snacks", "Blinkit Sunday Essentials"
  store_name?: string | null;
  status: GroupCartStatus;
  lock_at: string; // Time when cart locks for ordering
  pickup_instructions?: string | null;
  total_estimated_amount: number;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  id: string;
  cart_id: string;
  added_by_user_id: string;
  item_name: string;
  quantity: number;
  unit_price_estimate?: number | null;
  notes?: string | null;
  is_fulfilled?: boolean;
  created_at: string;
}

export interface SharedRide {
  id: string;
  community_id: string;
  created_by_user_id: string;
  pickup_point: string; // Defaults to community verified taxi pickup point
  destination: string; // e.g. "Airport Terminal 2", "Kalupur Railway Station"
  departure_time: string;
  total_seats: number;
  available_seats: number;
  estimated_cost_per_seat?: number | null;
  status: SharedRideStatus;
  luggage_details?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RideParticipant {
  id: string;
  ride_id: string;
  user_id: string;
  seats_reserved: number;
  joined_at: string;
  notes?: string | null;
}

export interface ChatMessage {
  id: string;
  conversation_type: 'cart' | 'ride';
  context_id: string; // cart_id or ride_id
  sender_user_id: string;
  message_text: string;
  created_at: string;
}
