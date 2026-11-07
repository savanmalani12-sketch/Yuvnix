# Known Concerns, Technical Debt & Architectural Risks — Yuvnix

## 1. Development Placeholder Environment Mode
- **Status**: Temporary development fallback in place.
- **Description**:
  - The repository currently runs with placeholder Supabase credentials in `.env.example`.
  - While `env.ts` provides safe mock fallbacks and `ConfigurationBanner.tsx` alerts developers, actual authentication and database mutations require provisioning a real Supabase project.
- **Remediation**:
  - Developers must provision a Supabase project and provide real `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in their local `.env`.

---

## 2. Supabase SQL Migrations Execution
- **Status**: Schemas defined in TypeScript (`src/types/database.ts`), SQL migrations pending execution on live database.
- **Description**:
  - The TypeScript definitions represent the exact PostgreSQL table schemas and relationships.
  - An initial SQL migration script must be executed in the Supabase SQL Editor to create tables, foreign keys, and RLS policies before live data can flow.
- **Remediation**:
  - Package the table creation scripts and RLS policies into `supabase/migrations/20261107_initial_schema.sql` for automated or manual execution.

---

## 3. Realtime Subscription Channel Volume & Mobile Battery
- **Status**: Future scalability concern.
- **Description**:
  - Having students subscribed to multiple active carts and shared rides simultaneously via WebSockets can increase battery drain on mobile devices if unmanaged.
- **Remediation**:
  - Throttle Supabase Realtime channel events (`eventsPerSecond: 10`).
  - Unsubscribe from inactive rooms when a student navigates away from a specific cart/ride screen.

---

## 4. Peer Flake Risk (Non-Technical / Behavioral Risk)
- **Status**: Product-level risk intrinsic to peer-to-peer coordination.
- **Description**:
  - In a group grocery order, if the coordinator places the order and a peer refuses to pay their share, or in a shared ride, if a participant cancels last minute.
- **Mitigation Strategy (Phase 2 Roadmap)**:
  - Add peer reliability score / badge (e.g. *"Joined 12 carts, 100% verified"*).
  - Add lock-in countdown timer before external order placement.
  - Require coordinator confirmation before locking a cart.
