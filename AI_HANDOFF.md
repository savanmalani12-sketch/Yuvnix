# 🚀 Yuvnix — Master AI Context & Project Handoff (AI_HANDOFF.md)
> **Purpose**: This document is the definitive master briefing for any incoming AI assistant, developer, or new chat session. When starting or resuming work on Yuvnix, read this document to instantly load 100% project context, technical invariants, domain rules, and implementation status.

---

## 1. 📌 Project Identity & Vision
* **Project Name**: Yuvnix
* **Tagline**: *Your people. Your community.*
* **Domain / Purpose**: Student-first hyperlocal community platform. Enables students living in campus hostels, PGs, and apartments to coordinate group grocery orders and find peers for shared taxi rides.
* **Target Audience**: College and university students residing in hostels, PGs, rented apartments, and student housing clusters.
* **Deployment Target**: Cloudflare Pages (Mobile-first SPA edge distribution).
* **Current Version**: `0.1.0` (Project Foundation & Architecture Complete).
* **Current Build Status**: **100% Clean** (`npm run typecheck` exits with 0 errors; `npm run build` succeeds in 1.09s).

---

## 2. 🏛️ Core Technical Architecture & Tech Stack

| Layer | Technology | Role & Notes |
|---|---|---|
| **Frontend Framework** | **React 18.3.1 + Vite 6.1.0** | Modern component architecture, fast HMR, manual chunk splitting in `vite.config.ts`. |
| **Language** | **TypeScript 5.7.3** | Strict type-safety enabled (`strict: true`). Zero `any` policy. |
| **Styling & Design System** | **Tailwind CSS 3.4 + Radix UI** | Indigo/Violet palette (`#4f46e5` / `#7c3aed`), shadcn/ui design tokens, accessible Radix headless primitives. |
| **Client Routing** | **React Router v6.28.2** | Nested layouts via `<Outlet />`, responsive navigation switching between mobile BottomNav and desktop Header. |
| **Backend & Database** | **Supabase (PostgreSQL 15)** | Row Level Security (RLS), typed client queries, real-time channels. Client initialized strictly with public anon key. |
| **Authentication** | **Supabase Auth (Google OAuth 2.0 PKCE)** | Primary student auth provider with automatic profile provisioning on first login. |
| **Server State & Caching** | **TanStack Query v5.66.0** | Cached queries with 3-minute stale time and single retry. |
| **Form Management** | **React Hook Form 7 + Zod 3** | Uncontrolled forms backed by runtime Zod validation schemas. |

---

## 3. ⚙️ Inviolable Product Rules & Architectural Invariants

Any AI assistant or developer modifying this repository MUST strictly follow these rules:

1. **Communities are Physical Residences, NOT Colleges**:
   - Communities represent real physical buildings (e.g. *"PDEU Hostel"*, *"Sunrise PG"*, *"Friends Apartment"*).
   - College is optional metadata (`college_affiliation`), never the community identity itself.
2. **Staff Approval Required for Communities**:
   - Students submit community creation requests (`status: 'pending'`).
   - Only authorized Yuvnix staff can approve and publish communities to the directory.
3. **No Student Feudal Hierarchy**:
   - Creating or requesting a community gives no permanent superior authority, veto power, or admin control over other students.
4. **Verified Shared Pickup Points**:
   - Every community enforces verified pickup locations: `delivery_pickup_point` (for groceries) and `taxi_pickup_point` (for cabs).
5. **Multi-Community Membership**:
   - Students can join multiple communities and participate in multiple carts/rides concurrently.
6. **Group Grocery Orders**:
   - Feature structured item lists, quantities, notes, ordering lock deadlines, and contextual group chat.
7. **Shared Taxi Rides**:
   - Feature pickup point, destination, departure time, seat availability (max 6), and contextual group chat.
8. **Zero Payment Gateway Integration (MVP)**:
   - Students independently decide who orders, pays, and collects.
   - Peer-to-peer reimbursement (direct UPI/cash). Yuvnix charges NO fees and holds NO funds.
9. **Zero Service-Role Keys**:
   - Never expose Supabase service-role keys in frontend code, client bundles, or environment variables. All access control must be enforced via PostgreSQL Row Level Security (RLS).
10. **Mobile-First Responsive Design**:
    - Bottom navigation on mobile screens (< 768px), horizontal navbar on desktop (≥ 768px). Always maintain accessible 44px tap targets.

---

## 4. 📂 Codebase Inventory & Key Files

* **`docs/PRODUCT_SPEC.md`**: Complete product specification document detailing all 12 product rules.
* **`docs/ARCHITECTURE.md`**: Deep architecture specification detailing PostgreSQL schema, RLS policies, and deployment rules.
* **`README.md`**: Project setup, scripts, environment variables, and development instructions.
* **`.planning/codebase/`**: 7 structured codebase mapping documents (`STACK.md`, `INTEGRATIONS.md`, `ARCHITECTURE.md`, `STRUCTURE.md`, `CONVENTIONS.md`, `TESTING.md`, `CONCERNS.md`).
* **`src/types/`**:
  * `domain.ts`: Pure domain entities and enums.
  * `database.ts`: Complete PostgreSQL schema types for Supabase.
  * `auth.ts`: Authentication state interfaces.
* **`src/schemas/`**:
  * `community.ts`: `communityCreationRequestSchema`.
  * `cart.ts`: `createGroupCartSchema`, `addCartItemSchema`.
  * `ride.ts`: `createSharedRideSchema`, `joinRideSchema`.
* **`src/services/supabase.ts`**: Initialized Supabase client with PKCE OAuth helper and logout method.
* **`src/hooks/useAuth.tsx`**: Context provider managing user session, profile loading, and profile auto-creation.
* **`src/components/layout/`**: `AppLayout.tsx`, `Header.tsx`, `BottomNav.tsx`, `PageContainer.tsx`.
* **`src/pages/`**:
  * `HomePage.tsx`: Landing page with value pillars and call-to-actions.
  * `CommunitiesPage.tsx`: Searchable community directory.
  * `CommunityRequestPage.tsx`: Form for students to propose new residences.
  * `CartsPage.tsx`: Hyperlocal grocery cart listings.
  * `RidesPage.tsx`: Shared taxi ride listings.
  * `ProfilePage.tsx`: Student account overview and signout.
  * `AuthCallbackPage.tsx`: OAuth redirect processor.

---

## 5. 🚦 Verification Status & Next Phase Roadmap

### Verification Status:
* `npm run typecheck` ➔ **PASSED (0 errors)**
* `npm run build` ➔ **PASSED (Vite production build in 1.09s)**

### Immediate Next Phase (Phase 1: Live Supabase Backend & Data Mutations):
1. **Supabase SQL Migration**: Execute PostgreSQL schema and RLS policies on live Supabase instance.
2. **TanStack Query Mutations**: Connect `CommunityRequestPage` form directly to live `community_creation_requests` table.
3. **Cart & Ride Creation Modals**: Implement interactive modals on `CartsPage` and `RidesPage` wired to Zod schemas.
4. **Realtime Group Chat**: Wire Supabase Realtime channels for in-cart and in-ride messaging.
