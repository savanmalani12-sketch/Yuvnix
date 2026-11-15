# Ingested Requirements

Source: `docs/PRODUCT_SPEC.md`

## 1. Authentication & Student Profiles
- **REQ-AUTH-01:** Google OAuth 2.0 authentication.
- **REQ-AUTH-02:** Automated database trigger on `auth.users` creates `profiles` (public) and `profile_private` (private).
- **REQ-AUTH-03:** Student phone number and email remain private in `profile_private` under strict `auth.uid() = id` RLS.
- **REQ-AUTH-04:** Handle (`@username`) display format throughout chat and order items.

## 2. Residential Communities
- **REQ-COMM-01:** Discovery feed filtering by city, general area, hostel/PG name, and college affiliation.
- **REQ-COMM-02:** Multi-community membership support (students can join multiple hostels/PGs).
- **REQ-COMM-03:** Resident-only access to Tier 2 pickup points (delivery foyer and cab meetup curb).
- **REQ-COMM-04:** Community request workflow with staff-only review and approval.
- **REQ-COMM-05:** Embedded group grocery carts directly within community cards.

## 3. Group Grocery Orders
- **REQ-CART-01:** Host must add their initial items first when starting a group cart.
- **REQ-CART-02:** Host defines the store's free delivery minimum (₹) with live remaining calculations.
- **REQ-CART-03:** Itemized product list with item name, quantity, estimated price, and personal notes.
- **REQ-CART-04:** Live progress tracker displaying remaining amount needed from neighbors to unlock ₹0 delivery.
- **REQ-CART-05:** Automatic community-wide notification to neighbors when a new cart is launched.
- **REQ-CART-06:** UTC ordering lock countdown timer (`lock_at`).
- **REQ-CART-07:** Real-time group cart chat displaying student handles only.

## 4. Shared Taxi Rides
- **REQ-RIDE-01:** Listings with departure pickup point, destination, departure time, and seat capacity.
- **REQ-RIDE-02:** Atomic seat reservation request flow (`request_ride_seats`).
- **REQ-RIDE-03:** Host seat acceptance and decline RPCs (`accept_ride_participant`, `decline_ride_participant`).
- **REQ-RIDE-04:** Rider and host seat cancellation with atomic seat restoration (`cancel_ride_reservation`).
- **REQ-RIDE-05:** Dedicated ride coordination chat restricted strictly to accepted riders and the host.
