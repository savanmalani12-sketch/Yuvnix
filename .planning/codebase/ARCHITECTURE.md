# System Architecture & Design Patterns — Yuvnix

## 1. High-Level Architectural Pattern
Yuvnix follows a **Serverless Mobile-First Single-Page Application (SPA)** architecture backed by **PostgreSQL Backend-as-a-Service (Supabase)**.

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Browser                        │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              AppLayout (Header / BottomNav)           │  │
│  └──────────────────────────┬────────────────────────────┘  │
│                             │                               │
│              ┌──────────────┴──────────────┐                │
│              ▼                             ▼                │
│       React Router v6             TanStack Query v5         │
│     (Client-side Routes)         (Server State Cache)       │
│              │                             │                │
│              └──────────────┬──────────────┘                │
│                             ▼                               │
│                     Supabase JS Client                      │
│                    (Auth PKCE + Realtime)                   │
└─────────────────────────────┼───────────────────────────────┘
                              │ HTTPS / WSS
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Supabase Cloud                         │
│                                                             │
│  ┌───────────────────┐               ┌───────────────────┐  │
│  │   Supabase Auth   │               │ Supabase Realtime │  │
│  │  (Google OAuth)   │               │   (WebSockets)    │  │
│  └─────────┬─────────┘               └─────────┬─────────┘  │
│            │                                   │            │
│            ▼                                   ▼            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │            PostgreSQL Database Engine                 │  │
│  │  - Row Level Security (RLS) per table                 │  │
│  │  - Foreign Keys & Referential Integrity               │  │
│  │  - Check Constraints on enums & states                │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Relational Database Schema & Entities

The relational database architecture is codified in `src/types/database.ts` and `src/types/domain.ts`:

### 2.1 Core Entities & Relationships
1. **`profiles`**: Linked 1:1 with `auth.users.id`.
   - Stores `full_name`, `avatar_url`, `phone_number`, `role` (`'student' | 'support_staff' | 'admin'`).
2. **`communities`**: Verified residential locations (hostels, PGs, apartments).
   - Contains `delivery_pickup_point`, `taxi_pickup_point`, `is_verified`, `active_member_count`.
3. **`community_memberships`**: Join table supporting multi-community membership (`user_id` + `community_id`).
4. **`community_creation_requests`**: Vetting pipeline for student-submitted communities.
   - States: `'pending' | 'approved' | 'rejected'`.
5. **`group_carts`**: Hyperlocal grocery & late-night snack orders.
   - States: `'open' | 'locked' | 'ordered' | 'completed' | 'cancelled'`.
6. **`cart_items`**: Line items inside a cart with quantity, estimated unit price, and requester ID.
7. **`shared_rides`**: Shared taxi/cab listings.
   - States: `'open' | 'full' | 'departed' | 'completed' | 'cancelled'`.
8. **`ride_participants`**: Join table tracking seat reservations (`seats_reserved`, `joined_at`).
9. **`chat_messages`**: Contextual messaging bound to either a `cart` or `ride`.

---

## 3. Security Architecture: Row Level Security (RLS) Model

The application strictly avoids database-level service-role keys on the client. PostgreSQL RLS policies enforce all access rules:

1. **`communities`**:
   - `SELECT`: Publicly readable by all authenticated users (and unauthenticated visitors for discovery).
   - `INSERT / UPDATE / DELETE`: Restricted strictly to staff and admins (`profiles.role IN ('support_staff', 'admin')`).
2. **`community_creation_requests`**:
   - `INSERT`: Any authenticated student can submit a request with `requested_by_user_id = auth.uid()`.
   - `SELECT`: Students can read their own submissions; staff can read all requests.
   - `UPDATE`: Only staff can update status (`approved` / `rejected`).
3. **`group_carts` & `shared_rides`**:
   - `SELECT`: Readable by active members of that community.
   - `INSERT`: Permitted by active community members.
   - `UPDATE`: Coordinator/creator can modify status or instructions.
4. **`cart_items`**:
   - `INSERT`: Any participant can add items while cart status is `open`.
   - `UPDATE / DELETE`: Only the student who added the item or the cart creator can modify it.
5. **`chat_messages`**:
   - Scoped strictly to verified participants of that specific cart or ride.

---

## 4. UI/UX Responsive Architecture

- **Mobile Viewports (< 768px)**:
  - Fixed top bar with logo, community indicator, and auth avatar.
  - Floating Bottom Navigation (`BottomNav.tsx`) with high-touch target icons (`Communities`, `Group Carts`, `Shared Rides`, `Profile`).
  - `pb-20` on `AppLayout.tsx` prevents content clipping behind the navigation bar.
- **Desktop / Tablet Viewports (≥ 768px)**:
  - Bottom navigation bar hidden (`md:hidden`).
  - Top header expands into full horizontal navigation bar (`md:flex`) with active route indicators and quick action buttons.
