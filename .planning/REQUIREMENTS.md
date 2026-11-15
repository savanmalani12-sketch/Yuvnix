# Requirements Document

## Milestone 1: Residential Community Foundation (Shipped)
- [x] **REQ-COMM-01:** Physical residential community directory with search and college affiliation filter.
- [x] **REQ-COMM-02:** Two-tier location privacy model via PostgreSQL RLS on `community_pickup_points`.
- [x] **REQ-COMM-03:** Multi-community membership support via `community_memberships`.
- [x] **REQ-COMM-04:** Community request form with administrative review lifecycle.
- [x] **REQ-COMM-05:** Atomic `join_community` and `leave_community` RPC procedures.

## Milestone 2: Group Grocery Orders & Free Delivery Pooling (Shipped)
- [x] **REQ-CART-01:** Group cart creation requiring host items and store free delivery minimum threshold.
- [x] **REQ-CART-02:** Free delivery live calculation and progress bar showing remaining ₹ needed.
- [x] **REQ-CART-03:** Direct embedding of active group grocery carts inside community cards.
- [x] **REQ-CART-04:** Dynamic item manager with owner-only deletion and creator lock enforcement.
- [x] **REQ-CART-05:** Handle-only student anonymity (`@username`) in cart chat and item cards.
- [x] **REQ-CART-06:** Automated community notification triggers notifying neighbors of new carts.
- [x] **REQ-CART-07:** Race-condition-proof database locks on item addition and cart closure.

## Milestone 3: Shared Taxi Rides (Shipped)
- [x] **REQ-RIDE-01:** Shared ride listing with departure time, pickup point, destination, and seats.
- [x] **REQ-RIDE-02:** Atomic 4-stage reservation RPCs (`request_ride_seats`, `accept_ride_participant`, `decline_ride_participant`, `cancel_ride_reservation`).
- [x] **REQ-RIDE-03:** Seat decrement and idempotent seat restoration upon cancellation.
- [x] **REQ-RIDE-04:** Private ride coordination chat restricted to host and accepted riders.

## Milestone 4: Notifications & User Experience (Shipped)
- [x] **REQ-UX-01:** Real-time in-app notification bell with unread badge counter.
- [x] **REQ-UX-02:** Mobile-optimized responsive layout with WCAG AA accessibility compliance.
- [x] **REQ-UX-03:** Dark mode support across all screens using semantic design tokens.
- [x] **REQ-UX-04:** PWA-ready manifest and installability.

## Milestone 5: Future Enhancements (Backlog)
- [ ] **REQ-FUT-01:** Postgres Realtime WebSocket channels replacing periodic HTTP polling.
- [ ] **REQ-FUT-02:** Push notifications (Web Push API) for mobile lock reminders.
- [ ] **REQ-FUT-03:** Community announcements and notice board for verified hostel residents.
