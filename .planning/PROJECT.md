# Yuvnix

> **Tagline:** Your people. Your community.  
> **Version:** 3.2.0 (Architecture v3.2 Final Certified Specification)  
> **Domain:** Hyperlocal residential coordination network for college students and young adults living in Hostels, PGs, and shared apartments.

---

## 1. Project Overview

Yuvnix eliminates everyday student logistical frictions around food delivery, grocery orders, and shared transit. While colleges serve as academic hubs, daily student life revolves around physical living quarters. Yuvnix bridges this gap with building-level peer coordination:
- **Group Grocery Orders:** Pool snack and grocery orders (Zepto, Blinkit, Instamart) with neighbors in the same building to meet order minimums and unlock ₹0 delivery fees.
- **Shared Taxi Rides:** Coordinate split cab rides from hostel/PG gates to airports, railway stations, bus terminals, and campuses.
- **Physical Communities:** Anchored strictly to real hostels and PGs with two-tier location privacy protecting residents.

---

## 2. Core Non-Negotiable Principles

1. **Physical Residences Only:** Communities are physical residential buildings, never colleges or departments. College affiliation is optional discovery metadata.
2. **Staff-Only Approval:** Students request communities; authorized support staff verify physical parameters before approving.
3. **No Administrative Hierarchy:** All residents participate on equal democratic footing. Early creators have zero moderating authority over peers.
4. **Two-Tier Privacy:** Public search metadata vs. Tier 2 resident-only pickup points (`community_pickup_points`) secured by PostgreSQL RLS.
5. **Handle Privacy:** Chat messages and order items display only `@username` handles to protect student privacy across multi-room hostels.
6. **Host-First Order Pooling:** Cart hosts must add their initial items first and define the store's free delivery minimum (₹).
7. **P2P Settlement:** No payment gateway or merchant checkout APIs in MVP. All money settled directly between peers via UPI or cash upon delivery.
8. **Free for Students:** Zero platform fees or commissions.

---

## 3. Technology Stack

- **Frontend:** React 18, TypeScript (strict mode), Vite 6, Tailwind CSS v3, Radix UI primitives, Lucide React icons.
- **State & Data Fetching:** TanStack React Query v5.
- **Backend & Database:** Supabase (PostgreSQL 15), Row-Level Security (RLS), SECURITY DEFINER transactional RPC functions, Database Triggers.
- **Authentication:** Supabase Auth (Google OAuth 2.0).
- **Deployment:** Netlify Continuous Deployment (`yuvnix.netlify.app`).

---

## 4. Key Workflows

- **Communities:** Discovery, search by landmark/college, membership join/leave, request new residence, embedded active cart feeds.
- **Group Grocery Carts:** Host order setup, store minimum threshold, live neighbor pool progress, UTC lock timer, item manager, handle-only chat.
- **Shared Rides:** 4-stage atomic booking (`request_ride_seats`, `accept_ride_participant`, `decline_ride_participant`, `cancel_ride_reservation`), seat accounting, accepted rider chat.
- **Notifications:** In-app real-time notification bell with automated community triggers on new cart creation.
