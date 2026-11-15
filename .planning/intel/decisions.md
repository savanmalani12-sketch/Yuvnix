# Ingested Architectural Decisions

Source: `docs/PRODUCT_SPEC.md` (Architecture v3.2) & `.planning/codebase/ARCHITECTURE.md`

## ADR-01: Residential Physicality Principle
- **Decision:** Communities represent physical, bounded residential structures (Hostel blocks, PGs, Apartments) rather than colleges, universities, or academic programs.
- **Rationale:** Day-to-day student logistics (groceries, rides, parcels) happen at their living quarters, not lecture halls.
- **Precedence:** Locked / Invariable.

## ADR-02: Two-Tier Location Privacy
- **Decision:** Split location data into Tier 1 (Public Discovery: name, area, city) and Tier 2 (Resident-Only: exact pickup points and foyer instructions).
- **Rationale:** Protect student safety and prevent non-residents from accessing private residential security instructions.
- **Enforcement:** PostgreSQL Row-Level Security (RLS) on `community_pickup_points` checking `is_community_member(community_id)`.

## ADR-03: Democratic Non-Hierarchical Residence Governance
- **Decision:** Community creators and early members receive zero administrative privileges or moderation powers over co-residents.
- **Rationale:** Prevent bullying, gatekeeping, or squatting.
- **Enforcement:** Fixed role `student` on profiles with database triggers blocking self-escalation.

## ADR-04: Group Cart Race-Condition-Proof Locking
- **Decision:** Use row-level `FOR SHARE` locks on parent `group_carts` during item modifications to conflict with in-flight cart status updates (`FOR NO KEY UPDATE`).
- **Rationale:** Prevent items from being added after a host has placed the order with the grocery merchant.

## ADR-05: 4-Stage Transactional Shared Ride Lifecycle
- **Decision:** Ride seat reservation transitions are governed strictly by 4 atomic RPCs (`request_ride_seats`, `accept_ride_participant`, `decline_ride_participant`, `cancel_ride_reservation`). Direct client `UPDATE` privileges on `ride_participants` are completely revoked.
- **Rationale:** Eliminate overbooking and race conditions during concurrent seat requests.

## ADR-06: Peer-to-Peer Settlement (Zero Payment Gateway)
- **Decision:** No payment gateway, escrow, or delivery merchant API integrations in MVP.
- **Rationale:** Zero regulatory overhead, zero student commissions, maximum simplicity with UPI peer-to-peer settlement upon physical parcel handover.

## ADR-07: Student Privacy via Handle-Only Chat
- **Decision:** Group Cart and Ride chats expose only `@username` handles; personal full names, emails, and phone numbers are hidden.
- **Rationale:** Preserve student privacy across multi-room hostel environments.
