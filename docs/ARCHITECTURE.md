# Yuvnix System Architecture & Database Specification

> **Version:** 3.2.1 (Architecture v3.2 Documented Specification)  
> **Status:** Specification Document (Documented — Not Executed — Pending Independent Verification)  
> **Target Deployment:** Cloudflare Pages (Frontend SPA) + Supabase PostgreSQL 15 (Managed Edge)

---

## 1. Architectural Overview

Yuvnix is engineered as a mobile-first Single Page Application (SPA) deployed to Cloudflare Pages edge network, backed by Supabase PostgreSQL 15 with strict Row Level Security (RLS), real-time WebSocket subscriptions, atomic transactional functions, and Google OAuth 2.0 PKCE authentication.

```mermaid
graph TD
    subgraph Client ["Client Layer (Cloudflare Pages Edge CDN)"]
        Browser[Student Mobile & Desktop Browsers]
        ViteSPA[React 18 + Vite + TypeScript SPA]
        Tailwind[Tailwind CSS + shadcn/ui Design System]
        Router[React Router v6]
        QueryCache[TanStack Query Server Cache]
        ZodValidator[Zod Schema Validation]
    end

    subgraph Backend ["Backend Layer (Supabase Managed Cloud)"]
        Auth[Supabase Auth (Google OAuth 2.0 PKCE)]
        PostgreSQL[(PostgreSQL 15 Database)]
        RLS[Row Level Security Engine]
        RealtimeWS[Supabase Realtime WebSockets]
        Triggers[DB Triggers & Hierarchical Atomic RPCs]
    end

    Browser --> ViteSPA
    ViteSPA --> Router
    Router --> QueryCache
    QueryCache --> ZodValidator
    ZodValidator -->|Anon Key HTTPS| RLS
    RLS --> Triggers
    Triggers --> PostgreSQL
    Browser -->|Google Sign-In| Auth
    Auth -->|Auto-provision Trigger| PostgreSQL
    Auth -->|JWT Session auth.uid| RLS
    PostgreSQL -->|Change Data Capture| RealtimeWS
    RealtimeWS -->|WebSockets| QueryCache
```

---

## 2. Technology Stack & Decision Matrix

| Layer | Technology | Architecture v3.2 Standards |
| :--- | :--- | :--- |
| **Build & Runtime** | Vite 6 + React 18 + TypeScript | Strict compiler configuration (`strict: true`, `noEmit: true`), zero type leakage, sub-second HMR. |
| **Design System** | Tailwind CSS + shadcn/ui | Radix UI primitives tokenized to an accessible Indigo/Violet palette (`hsl(var(--primary))`). Optimized for mobile touch ergonomics. |
| **Routing** | React Router v6 | Nested layouts (`AppLayout`, `BottomNav`, `Header`) and SPA fallback via Cloudflare `_redirects`. |
| **State & Cache** | TanStack Query v5 | Automated background cache invalidation, deduplication, and real-time cache mutations. |
| **Form Validation** | React Hook Form + Zod | Uncontrolled performant inputs validated against strict compile-time Zod schemas. |
| **Database & Auth** | Supabase (PostgreSQL 15) | Relational integrity, foreign keys, deterministic row locking (`FOR UPDATE`, `FOR SHARE`), column privilege isolation, and fixed `search_path` security functions. |
| **Edge Hosting** | Cloudflare Pages | Sub-50ms TTFB across Indian cellular networks; automated GitHub preview and production pipelines. |

---

## 3. Directory Structure

```text
yuvnix/
├── docs/
│   ├── PRODUCT_SPEC.md          # 12 Core Product Rules, Personas & Sequence Flows
│   └── ARCHITECTURE.md          # Complete technical design, DDL, RLS & Concurrency
├── public/
│   ├── _redirects               # Cloudflare Pages SPA rewrite rule (/* -> /index.html 200)
│   └── vite.svg
├── src/
│   ├── components/
│   │   ├── common/              # BrandLogo, StatusBadge, EmptyState, ConfigurationBanner
│   │   ├── layout/              # AppLayout, Header, BottomNav, PageContainer
│   │   └── ui/                  # shadcn/ui primitives (Button, Card, Badge, Input, Label, Avatar)
│   ├── hooks/                   # useAuth, useMediaQuery
│   ├── pages/                   # Route views: Home, Communities, Request, Carts, Rides, Profile
│   ├── schemas/                 # Zod runtime schemas (community, cart, ride)
│   ├── services/                # Supabase client configuration & OAuth handlers
│   ├── types/                   # TypeScript database types, domain interfaces, and auth models
│   ├── utils/                   # cn, formatters, type-safe env validator
│   ├── App.tsx                  # Root component with Providers & React Router
│   ├── index.css                # Tailwind base directives & color design tokens
│   ├── main.tsx                 # React DOM mount
│   └── vite-env.d.ts            # Client environment typing
├── .env.example                 # Environment variable template
├── components.json              # shadcn/ui configuration
├── index.html                   # Mobile-first viewport & typography
├── package.json                 # Dependency manifests & build scripts
├── postcss.config.js            # PostCSS configuration
├── tailwind.config.js           # Indigo/Violet theme tokens & keyframes
├── tsconfig.json                # Strict TypeScript configuration
└── vite.config.ts               # Vite configuration with chunk splitting & path aliases
```

---

## 4. Complete PostgreSQL DDL Specification (Architecture v3.2)

> **Timestamp Standard:** All timestamps in Architecture v3.2 use `TIMESTAMPTZ` with `DEFAULT now()`. Direct comparisons against `now()` preserve timezone-independent UTC epoch ordering without dangerous conversions to naive timestamps.

```sql
-- =============================================================================
-- 1. EXTENSIONS & ENUMS
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM ('student', 'support_staff', 'admin');
CREATE TYPE residential_type AS ENUM ('hostel', 'pg', 'apartment', 'other');
CREATE TYPE community_request_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE group_cart_status AS ENUM ('open', 'locked', 'ordered', 'completed', 'cancelled');
CREATE TYPE ride_participant_status AS ENUM ('pending', 'accepted', 'declined', 'cancelled');
CREATE TYPE shared_ride_status AS ENUM ('open', 'full', 'departed', 'completed', 'cancelled');
CREATE TYPE notification_type AS ENUM (
    'community_request_approved',
    'community_request_rejected',
    'cart_lock_imminent',
    'cart_order_placed',
    'ride_seat_requested',
    'ride_seat_accepted',
    'ride_seat_declined'
);

-- =============================================================================
-- 2. STUDENT PROFILES (PUBLIC vs PRIVATE ISOLATION)
-- =============================================================================

-- 2.1 Public Student Profiles (Safe for general authenticated display)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    role user_role NOT NULL DEFAULT 'student',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.2 Private Student Profiles (Phone & Email isolated under strict self-only RLS)
CREATE TABLE public.profile_private (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    phone_number TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 3. COMMUNITIES & TWO-TIER LOCATION PRIVACY
-- =============================================================================

-- 3.1 Communities (Public Discovery Tier: City, College Tag, General Area)
CREATE TABLE public.communities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    type residential_type NOT NULL,
    college_affiliation TEXT, -- Optional discovery metadata
    city TEXT NOT NULL,
    state TEXT,
    general_area TEXT,        -- Non-sensitive neighborhood landmark
    is_verified BOOLEAN NOT NULL DEFAULT true,
    active_member_count INT NOT NULL DEFAULT 0 CHECK (active_member_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.2 Community Pickup Points (Protected Tier 2: Resident-Only Access)
CREATE TABLE public.community_pickup_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL UNIQUE REFERENCES public.communities(id) ON DELETE CASCADE,
    physical_address TEXT NOT NULL,
    delivery_pickup_point TEXT NOT NULL, -- e.g. Gate 1 Security Desk
    taxi_pickup_point TEXT NOT NULL,     -- e.g. Gate 1 Circle Curb
    gate_instructions TEXT,              -- e.g. Security check procedure
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.3 Community Memberships (Multi-community support)
CREATE TABLE public.community_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (community_id, user_id)
);

-- 3.4 Community Creation Requests (Subject to Staff Approval)
CREATE TABLE public.community_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requested_by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    proposed_name TEXT NOT NULL,
    proposed_type residential_type NOT NULL,
    college_affiliation TEXT,
    proposed_address TEXT NOT NULL,
    proposed_delivery_pickup_point TEXT NOT NULL,
    proposed_taxi_pickup_point TEXT NOT NULL,
    status community_request_status NOT NULL DEFAULT 'pending',
    reviewed_by_staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    review_notes TEXT,
    created_community_id UUID REFERENCES public.communities(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 4. GROUP GROCERY CARTS & CHAT
-- =============================================================================

-- 4.1 Group Carts Table
CREATE TABLE public.group_carts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
    created_by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    store_name TEXT,
    status group_cart_status NOT NULL DEFAULT 'open',
    lock_at TIMESTAMPTZ NOT NULL,
    pickup_instructions TEXT,
    total_estimated_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (total_estimated_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4.2 Cart Participants Table (Enables joining cart without adding products)
CREATE TABLE public.cart_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cart_id UUID NOT NULL REFERENCES public.group_carts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (cart_id, user_id)
);

-- 4.3 Cart Items Table
CREATE TABLE public.cart_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cart_id UUID NOT NULL REFERENCES public.group_carts(id) ON DELETE CASCADE,
    added_by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0 AND quantity <= 99),
    unit_price_estimate NUMERIC(10, 2) CHECK (unit_price_estimate IS NULL OR unit_price_estimate >= 0),
    notes TEXT,
    is_fulfilled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4.4 Dedicated Cart Chat Messages
CREATE TABLE public.cart_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cart_id UUID NOT NULL REFERENCES public.group_carts(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message_text TEXT NOT NULL CHECK (char_length(trim(message_text)) > 0 AND char_length(message_text) <= 2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 5. SHARED TAXI RIDES & CHAT
-- =============================================================================

-- 5.1 Shared Rides Table
CREATE TABLE public.shared_rides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
    created_by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    pickup_point TEXT NOT NULL,
    destination TEXT NOT NULL,
    departure_time TIMESTAMPTZ NOT NULL,
    total_seats INT NOT NULL CHECK (total_seats > 0 AND total_seats <= 8),
    available_seats INT NOT NULL CHECK (available_seats >= 0),
    estimated_cost_per_seat NUMERIC(10, 2) CHECK (estimated_cost_per_seat IS NULL OR estimated_cost_per_seat >= 0),
    status shared_ride_status NOT NULL DEFAULT 'open',
    luggage_details TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT available_not_exceed_total CHECK (available_seats <= total_seats)
);

-- 5.2 Ride Participants Table (Tracks seats & acceptance status)
CREATE TABLE public.ride_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ride_id UUID NOT NULL REFERENCES public.shared_rides(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    seats_reserved INT NOT NULL DEFAULT 1 CHECK (seats_reserved > 0 AND seats_reserved <= 6),
    status ride_participant_status NOT NULL DEFAULT 'pending',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes TEXT,
    UNIQUE (ride_id, user_id)
);

-- 5.3 Dedicated Ride Chat Messages
CREATE TABLE public.ride_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ride_id UUID NOT NULL REFERENCES public.shared_rides(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message_text TEXT NOT NULL CHECK (char_length(trim(message_text)) > 0 AND char_length(message_text) <= 2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 6. NOTIFICATIONS
-- =============================================================================
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    link_url TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 7. PERFORMANCE INDEXES
-- =============================================================================
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_communities_slug ON public.communities(slug);
CREATE INDEX idx_communities_verified ON public.communities(is_verified);
CREATE INDEX idx_pickup_points_community ON public.community_pickup_points(community_id);
CREATE INDEX idx_community_memberships_user ON public.community_memberships(user_id);
CREATE INDEX idx_community_memberships_community ON public.community_memberships(community_id);
CREATE INDEX idx_community_requests_user ON public.community_requests(requested_by_user_id);
CREATE INDEX idx_community_requests_status ON public.community_requests(status);
CREATE INDEX idx_group_carts_community ON public.group_carts(community_id);
CREATE INDEX idx_group_carts_status ON public.group_carts(status);
CREATE INDEX idx_group_carts_lock_at ON public.group_carts(lock_at);
CREATE INDEX idx_cart_participants_lookup ON public.cart_participants(cart_id, user_id);
CREATE INDEX idx_cart_items_cart ON public.cart_items(cart_id);
CREATE INDEX idx_cart_items_added_by ON public.cart_items(added_by_user_id);
CREATE INDEX idx_cart_messages_cart ON public.cart_messages(cart_id, created_at ASC);
CREATE INDEX idx_shared_rides_community ON public.shared_rides(community_id);
CREATE INDEX idx_shared_rides_departure ON public.shared_rides(departure_time);
CREATE INDEX idx_shared_rides_status ON public.shared_rides(status);
CREATE INDEX idx_ride_participants_lookup ON public.ride_participants(ride_id, user_id);
CREATE INDEX idx_ride_participants_status ON public.ride_participants(ride_id, status);
CREATE INDEX idx_ride_messages_ride ON public.ride_messages(ride_id, created_at ASC);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);
```

---

## 5. PostgreSQL Triggers & Atomic Functions (Architecture v3.2)

Every function runs with fixed `SET search_path = public` to defeat search-path poisoning, strictly validates session identity using `auth.uid()`, compares timestamps directly against `now()`, and applies hierarchical row locking.

### 5.1 Automated User Provisioning Trigger
Automatically provisions `profiles` and `profile_private` rows upon Google OAuth registration. Role is strictly assigned to `'student'`.

```sql
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Student'),
        NEW.raw_user_meta_data->>'avatar_url',
        'student'::user_role
    );

    INSERT INTO public.profile_private (id, email)
    VALUES (NEW.id, NEW.email);

    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_auth_user();
```

---

### 5.2 Role Escalation Prevention Trigger
Rejects any attempt by authenticated users to alter their `role` column on `public.profiles`.

```sql
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        -- Only internal server processes (auth.uid() IS NULL) or existing admins can alter roles
        IF auth.uid() IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'::user_role
        ) THEN
            RAISE EXCEPTION 'Privilege escalation rejected: Users cannot modify their own account role.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_role_escalation
    BEFORE UPDATE OF role ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_role_escalation();
```

---

### 5.3 Automated Cart Creator Participation Trigger
Ensures that when a host inserts a cart in `group_carts`, their membership in `cart_participants` is created atomically in the same transaction.

```sql
CREATE OR REPLACE FUNCTION public.auto_join_cart_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.cart_participants (cart_id, user_id)
    VALUES (NEW.id, NEW.created_by_user_id)
    ON CONFLICT (cart_id, user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_join_cart_creator
    AFTER INSERT ON public.group_carts
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_join_cart_creator();
```

---

### 5.4 Concurrency-Proof Cart Locking Trigger (`FOR SHARE`)
Eliminates race conditions between cart closure and item modification by locking the parent cart row with `FOR SHARE`. This strictly conflicts with in-flight cart updates acquiring `FOR NO KEY UPDATE` or `FOR UPDATE`.

```sql
CREATE OR REPLACE FUNCTION public.enforce_cart_item_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cart_status group_cart_status;
    v_lock_at TIMESTAMPTZ;
    v_cart_id UUID;
BEGIN
    v_cart_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.cart_id ELSE NEW.cart_id END;

    -- Lock parent cart row with FOR SHARE to strictly conflict with NO KEY UPDATE during cart closure
    SELECT status, lock_at INTO v_cart_status, v_lock_at
    FROM public.group_carts
    WHERE id = v_cart_id
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Referenced group cart does not exist.';
    END IF;

    -- Direct TIMESTAMPTZ comparison against now()
    IF v_cart_status != 'open'::group_cart_status OR v_lock_at <= now() THEN
        RAISE EXCEPTION 'Cart is locked or closed. Items cannot be added, edited, or deleted.';
    END IF;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER trg_enforce_cart_item_lock
    BEFORE INSERT OR UPDATE OR DELETE ON public.cart_items
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_cart_item_lock();
```

---

### 5.5 Student Ride Seat Request Function (`FOR SHARE` Locked)
Called by a student to submit a pending seat reservation. Locks the parent `shared_rides` row with `FOR SHARE` (Lock Hierarchy Level 1) to eliminate race conditions with ride closure, and uses an atomic `INSERT ... ON CONFLICT` statement to prevent duplicate or overwritten requests.

```sql
CREATE OR REPLACE FUNCTION public.request_ride_seats(
    p_ride_id UUID,
    p_seats_requested INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_available INT;
    v_status shared_ride_status;
    v_departure TIMESTAMPTZ;
    v_host_id UUID;
    v_rider_name TEXT;
    v_existing_status ride_participant_status;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Active user session required.';
    END IF;

    IF p_seats_requested <= 0 OR p_seats_requested > 4 THEN
        RAISE EXCEPTION 'Invalid seat request: Must reserve between 1 and 4 seats.';
    END IF;

    -- Lock Hierarchy Level 1: Lock parent shared_rides row with FOR SHARE.
    -- Conflicts with concurrent ride cancellation/closure (FOR NO KEY UPDATE / FOR UPDATE).
    SELECT available_seats, status, departure_time, created_by_user_id
    INTO v_available, v_status, v_departure, v_host_id
    FROM public.shared_rides
    WHERE id = p_ride_id
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ride offer does not exist.';
    END IF;

    IF v_host_id = v_user_id THEN
        RAISE EXCEPTION 'Ride hosts cannot request seats on their own ride.';
    END IF;

    -- Direct comparison of TIMESTAMPTZ against now()
    IF v_status != 'open'::shared_ride_status OR v_departure <= now() THEN
        RAISE EXCEPTION 'Ride is no longer accepting reservation requests.';
    END IF;

    IF v_available < p_seats_requested THEN
        RAISE EXCEPTION 'Insufficient seats available (Requested: %, Available: %).', p_seats_requested, v_available;
    END IF;

    -- Lock Hierarchy Level 2: Atomic insert/reactivation backed by UNIQUE (ride_id, user_id)
    INSERT INTO public.ride_participants (ride_id, user_id, seats_reserved, status)
    VALUES (p_ride_id, v_user_id, p_seats_requested, 'pending'::ride_participant_status)
    ON CONFLICT (ride_id, user_id) DO UPDATE
    SET seats_reserved = EXCLUDED.seats_reserved,
        status = 'pending'::ride_participant_status,
        joined_at = now()
    WHERE ride_participants.status IN ('declined'::ride_participant_status, 'cancelled'::ride_participant_status);

    -- If no row was inserted or updated, evaluate conflict reason and abort transaction
    IF NOT FOUND THEN
        SELECT status INTO v_existing_status
        FROM public.ride_participants
        WHERE ride_id = p_ride_id AND user_id = v_user_id;

        IF v_existing_status = 'pending'::ride_participant_status THEN
            RAISE EXCEPTION 'A pending seat request is already active for this ride.';
        ELSIF v_existing_status = 'accepted'::ride_participant_status THEN
            RAISE EXCEPTION 'User already has an accepted reservation on this ride.';
        ELSE
            RAISE EXCEPTION 'Unable to register ride request due to concurrent state change.';
        END IF;
    END IF;

    -- Dispatch notification to the ride host ONLY upon successful registration
    SELECT full_name INTO v_rider_name FROM public.profiles WHERE id = v_user_id;

    INSERT INTO public.notifications (user_id, type, title, body, link_url)
    VALUES (
        v_host_id,
        'ride_seat_requested'::notification_type,
        'Seat Reservation Request',
        COALESCE(v_rider_name, 'A student') || ' requested ' || p_seats_requested || ' seat(s).',
        '/rides/' || p_ride_id::text
    );

    RETURN jsonb_build_object(
        'success', true,
        'status', 'pending',
        'ride_id', p_ride_id,
        'seats_requested', p_seats_requested
    );
END;
$$;
```

---

### 5.6 Host Ride Acceptance Function (Consistent Lock Hierarchy)
Called by the ride host to accept a pending applicant. Locks rows in a consistent hierarchy (`shared_rides` first `FOR UPDATE`, then `ride_participants` `FOR UPDATE`) and decrements `available_seats` atomically.

```sql
CREATE OR REPLACE FUNCTION public.accept_ride_participant(
    p_ride_id UUID,
    p_applicant_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_host_id UUID := auth.uid();
    v_available INT;
    v_seats_requested INT;
    v_current_status ride_participant_status;
BEGIN
    IF v_host_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Active user session required.';
    END IF;

    -- 1. Lock shared_rides row FIRST (Lock Hierarchy Level 1)
    SELECT available_seats
    INTO v_available
    FROM public.shared_rides
    WHERE id = p_ride_id AND created_by_user_id = v_host_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unauthorized: Only the verified ride host can accept seat requests.';
    END IF;

    -- 2. Lock ride_participants row SECOND (Lock Hierarchy Level 2)
    SELECT seats_reserved, status
    INTO v_seats_requested, v_current_status
    FROM public.ride_participants
    WHERE ride_id = p_ride_id AND user_id = p_applicant_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Seat reservation request not found.';
    END IF;

    IF v_current_status = 'accepted'::ride_participant_status THEN
        RETURN jsonb_build_object('success', true, 'message', 'Participant already accepted.');
    END IF;

    IF v_current_status != 'pending'::ride_participant_status THEN
        RAISE EXCEPTION 'Cannot accept request in status: % (must be pending).', v_current_status;
    END IF;

    IF v_available < v_seats_requested THEN
        RAISE EXCEPTION 'Cannot accept: Available seats (%) less than requested (%).', v_available, v_seats_requested;
    END IF;

    -- Update participant status to accepted
    UPDATE public.ride_participants
    SET status = 'accepted'::ride_participant_status
    WHERE ride_id = p_ride_id AND user_id = p_applicant_user_id;

    -- Decrement available seats atomically
    UPDATE public.shared_rides
    SET available_seats = available_seats - v_seats_requested,
        status = CASE WHEN (available_seats - v_seats_requested) = 0 THEN 'full'::shared_ride_status ELSE status END,
        updated_at = now()
    WHERE id = p_ride_id;

    -- Dispatch notification to the accepted student
    INSERT INTO public.notifications (user_id, type, title, body, link_url)
    VALUES (
        p_applicant_user_id,
        'ride_seat_accepted'::notification_type,
        'Ride Seat Confirmed!',
        'Your seat request was accepted. You can now coordinate in the ride chat.',
        '/rides/' || p_ride_id::text
    );

    RETURN jsonb_build_object(
        'success', true,
        'ride_id', p_ride_id,
        'accepted_user', p_applicant_user_id,
        'remaining_seats', v_available - v_seats_requested
    );
END;
$$;
```

---

### 5.7 Host Ride Decline Function (Consistent Lock Hierarchy)
Called by the ride host to decline a pending applicant. Employs the identical lock sequence (`shared_rides` Level 1 $\rightarrow$ `ride_participants` Level 2) and notifies the applicant.

```sql
CREATE OR REPLACE FUNCTION public.decline_ride_participant(
    p_ride_id UUID,
    p_applicant_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_host_id UUID := auth.uid();
    v_current_status ride_participant_status;
BEGIN
    IF v_host_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Active user session required.';
    END IF;

    -- 1. Lock shared_rides row FIRST (Lock Hierarchy Level 1)
    PERFORM 1
    FROM public.shared_rides
    WHERE id = p_ride_id AND created_by_user_id = v_host_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unauthorized: Only the verified ride host can decline requests.';
    END IF;

    -- 2. Lock ride_participants row SECOND (Lock Hierarchy Level 2)
    SELECT status
    INTO v_current_status
    FROM public.ride_participants
    WHERE ride_id = p_ride_id AND user_id = p_applicant_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Seat reservation request not found.';
    END IF;

    IF v_current_status != 'pending'::ride_participant_status THEN
        RAISE EXCEPTION 'Cannot decline request: Current status is % (must be pending).', v_current_status;
    END IF;

    -- Update participant status to declined
    UPDATE public.ride_participants
    SET status = 'declined'::ride_participant_status
    WHERE ride_id = p_ride_id AND user_id = p_applicant_user_id;

    -- Dispatch notification to the declined student
    INSERT INTO public.notifications (user_id, type, title, body, link_url)
    VALUES (
        p_applicant_user_id,
        'ride_seat_declined'::notification_type,
        'Seat Request Update',
        'Your seat request was not accepted by the ride host.',
        '/rides'
    );

    RETURN jsonb_build_object(
        'success', true,
        'ride_id', p_ride_id,
        'declined_user', p_applicant_user_id,
        'status', 'declined'
    );
END;
$$;
```

---

### 5.8 Atomic Cancellation & Seat Release Function
Enforces caller authorization (must be either the rider cancelling their own seat or the host). Follows the identical lock hierarchy (`shared_rides` -> `ride_participants`), prevents duplicate seat releases, and bounds seats by `total_seats`.

```sql
CREATE OR REPLACE FUNCTION public.cancel_ride_reservation(
    p_ride_id UUID,
    p_participant_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_is_host BOOLEAN;
    v_seats_to_release INT;
    v_current_status ride_participant_status;
    v_total_seats INT;
    v_available_seats INT;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Active user session required.';
    END IF;

    -- Lock Hierarchy Level 1: shared_rides
    SELECT (created_by_user_id = v_caller_id), total_seats, available_seats
    INTO v_is_host, v_total_seats, v_available_seats
    FROM public.shared_rides
    WHERE id = p_ride_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Referenced ride offer does not exist.';
    END IF;

    IF v_caller_id != p_participant_user_id AND NOT v_is_host THEN
        RAISE EXCEPTION 'Unauthorized: You can only cancel your own reservations.';
    END IF;

    -- Lock Hierarchy Level 2: ride_participants
    SELECT seats_reserved, status
    INTO v_seats_to_release, v_current_status
    FROM public.ride_participants
    WHERE ride_id = p_ride_id AND user_id = p_participant_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Participant reservation record does not exist.';
    END IF;

    -- Idempotency: Prevent duplicate cancellations or double seat restoration
    IF v_current_status = 'cancelled'::ride_participant_status THEN
        RETURN jsonb_build_object('success', true, 'message', 'Reservation already cancelled.');
    END IF;

    -- Mark participant as cancelled
    UPDATE public.ride_participants
    SET status = 'cancelled'::ride_participant_status
    WHERE ride_id = p_ride_id AND user_id = p_participant_user_id;

    -- Restore seats ONLY if the participant was previously accepted
    IF v_current_status = 'accepted'::ride_participant_status THEN
        UPDATE public.shared_rides
        SET available_seats = LEAST(total_seats, available_seats + v_seats_to_release),
            status = 'open'::shared_ride_status,
            updated_at = now()
        WHERE id = p_ride_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'ride_id', p_ride_id,
        'participant_id', p_participant_user_id,
        'seats_released', CASE WHEN v_current_status = 'accepted'::ride_participant_status THEN v_seats_to_release ELSE 0 END
    );
END;
$$;
```

---

### 5.9 Notification Read RPC Function
Protects notification integrity by ensuring students can only mark notifications as read without touching title, body, or link.

```sql
CREATE OR REPLACE FUNCTION public.mark_notification_as_read(
    p_notification_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.notifications
    SET is_read = true
    WHERE id = p_notification_id AND user_id = auth.uid();

    RETURN FOUND;
END;
$$;
```

---

### 5.10 Community Request Notification Trigger
Dispatches deep-linked notifications upon community request approval or rejection.

```sql
CREATE OR REPLACE FUNCTION public.handle_community_request_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (OLD.status = 'pending'::community_request_status AND NEW.status = 'approved'::community_request_status) THEN
        INSERT INTO public.notifications (user_id, type, title, body, link_url)
        VALUES (
            NEW.requested_by_user_id,
            'community_request_approved'::notification_type,
            'Community Approved!',
            'Your request for "' || NEW.proposed_name || '" has been verified. Welcome to your community!',
            CASE WHEN NEW.created_community_id IS NOT NULL 
                 THEN '/communities/' || NEW.created_community_id::text 
                 ELSE '/communities' 
            END
        );
    ELSIF (OLD.status = 'pending'::community_request_status AND NEW.status = 'rejected'::community_request_status) THEN
        INSERT INTO public.notifications (user_id, type, title, body, link_url)
        VALUES (
            NEW.requested_by_user_id,
            'community_request_rejected'::notification_type,
            'Community Request Update',
            'Your request for "' || NEW.proposed_name || '" could not be approved. ' || COALESCE('Notes: ' || NEW.review_notes, ''),
            '/communities'
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_community_request_decision
    AFTER UPDATE OF status ON public.community_requests
    FOR EACH ROW
    WHEN (OLD.status = 'pending'::community_request_status AND NEW.status IN ('approved'::community_request_status, 'rejected'::community_request_status))
    EXECUTE FUNCTION public.handle_community_request_decision();
```

---

### 5.11 Secure Role Helper Function
Evaluates staff or admin status with fixed `search_path`.

```sql
CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('support_staff'::user_role, 'admin'::user_role)
    );
END;
$$;
```

---

## 6. Permissions, Grants & Full Privilege Audit (Architecture v3.2)

To prevent privilege leakage via inherited pseudo-roles (such as `PUBLIC`), all table, sequence, and function permissions are initially revoked from `PUBLIC` and `anon`. Grants are issued strictly to `authenticated` or gated behind column-level privileges.

```sql
-- =============================================================================
-- 1. BASE SECURITY: REVOKE DEFAULTS FROM PUBLIC AND ANON
-- =============================================================================
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;

-- =============================================================================
-- 2. FUNCTION EXECUTION GRANTS (AUTHENTICATED ONLY)
-- =============================================================================
GRANT EXECUTE ON FUNCTION public.is_staff_or_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_ride_seats(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_ride_participant(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_ride_participant(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_ride_reservation(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notification_as_read(UUID) TO authenticated;

-- =============================================================================
-- 3. TABLE & COLUMN PRIVILEGES MATRIX
-- =============================================================================

-- profiles: Read public directory; update ONLY display name & avatar (role revoked)
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (full_name, avatar_url) ON public.profiles TO authenticated;

-- profile_private: Self-only SELECT & UPDATE on phone_number
GRANT SELECT ON public.profile_private TO authenticated;
GRANT UPDATE (phone_number) ON public.profile_private TO authenticated;

-- communities: Public discovery SELECT; mutations revoked from students
GRANT SELECT ON public.communities TO authenticated;

-- community_pickup_points: Member-only SELECT; mutations revoked from students
GRANT SELECT ON public.community_pickup_points TO authenticated;

-- community_memberships: Students can join/leave
GRANT SELECT, INSERT, DELETE ON public.community_memberships TO authenticated;

-- community_requests: Students can view & submit
GRANT SELECT, INSERT ON public.community_requests TO authenticated;

-- group_carts: Community members can view, create & update cart metadata
GRANT SELECT, INSERT ON public.group_carts TO authenticated;
GRANT UPDATE (title, store_name, status, lock_at, pickup_instructions) ON public.group_carts TO authenticated;

-- cart_participants: Join/leave only
GRANT SELECT, INSERT, DELETE ON public.cart_participants TO authenticated;

-- cart_items: Add, view, delete, and update product details ONLY
-- cart_id and added_by_user_id are REVOKED to eliminate foreign key drift
GRANT SELECT, INSERT, DELETE ON public.cart_items TO authenticated;
GRANT UPDATE (item_name, quantity, unit_price_estimate, notes) ON public.cart_items TO authenticated;

-- cart_messages: Read and send
GRANT SELECT, INSERT ON public.cart_messages TO authenticated;

-- shared_rides: Offer and view rides; metadata updates granted
GRANT SELECT, INSERT ON public.shared_rides TO authenticated;
GRANT UPDATE (destination, departure_time, pickup_point, luggage_details, notes) ON public.shared_rides TO authenticated;

-- ride_participants: Direct mutations completely REVOKED (Governed strictly by RPCs)
GRANT SELECT ON public.ride_participants TO authenticated;

-- ride_messages: Read and send
GRANT SELECT, INSERT ON public.ride_messages TO authenticated;

-- notifications: Read and mark read
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (is_read) ON public.notifications TO authenticated;
```

---

## 7. Complete Row Level Security (RLS) Specification

RLS is enabled on **all 14 tables**.

```sql
-- Enable RLS across all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_private ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_pickup_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS 1: PROFILES (PUBLIC)
-- =============================================================================
CREATE POLICY "profiles_select_authenticated"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "profiles_update_self"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- =============================================================================
-- RLS 2: PROFILE_PRIVATE (STRICT PRIVACY)
-- =============================================================================
CREATE POLICY "profile_private_select_self"
    ON public.profile_private FOR SELECT
    TO authenticated
    USING (auth.uid() = id OR public.is_staff_or_admin());

CREATE POLICY "profile_private_update_self"
    ON public.profile_private FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- =============================================================================
-- RLS 3: COMMUNITIES (PUBLIC DISCOVERY TIER)
-- =============================================================================
CREATE POLICY "communities_select_verified"
    ON public.communities FOR SELECT
    TO authenticated
    USING (is_verified = true OR public.is_staff_or_admin());

CREATE POLICY "communities_staff_all"
    ON public.communities FOR ALL
    TO authenticated
    USING (public.is_staff_or_admin())
    WITH CHECK (public.is_staff_or_admin());

-- =============================================================================
-- RLS 4: COMMUNITY PICKUP POINTS (PROTECTED TIER 2: RESIDENTS ONLY)
-- =============================================================================
CREATE POLICY "pickup_points_select_members_only"
    ON public.community_pickup_points FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.community_memberships cm
            WHERE cm.community_id = community_pickup_points.community_id
              AND cm.user_id = auth.uid()
              AND cm.is_active = true
        ) OR public.is_staff_or_admin()
    );

CREATE POLICY "pickup_points_staff_all"
    ON public.community_pickup_points FOR ALL
    TO authenticated
    USING (public.is_staff_or_admin())
    WITH CHECK (public.is_staff_or_admin());

-- =============================================================================
-- RLS 5: COMMUNITY MEMBERSHIPS
-- =============================================================================
CREATE POLICY "memberships_select_community_or_self"
    ON public.community_memberships FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.community_memberships cm
            WHERE cm.community_id = community_memberships.community_id
              AND cm.user_id = auth.uid()
        ) OR public.is_staff_or_admin()
    );

CREATE POLICY "memberships_insert_self"
    ON public.community_memberships FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.communities c
            WHERE c.id = community_id AND c.is_verified = true
        )
    );

CREATE POLICY "memberships_delete_self"
    ON public.community_memberships FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- =============================================================================
-- RLS 6: COMMUNITY REQUESTS
-- =============================================================================
CREATE POLICY "community_requests_select"
    ON public.community_requests FOR SELECT
    TO authenticated
    USING (requested_by_user_id = auth.uid() OR public.is_staff_or_admin());

CREATE POLICY "community_requests_insert_student"
    ON public.community_requests FOR INSERT
    TO authenticated
    WITH CHECK (
        requested_by_user_id = auth.uid() AND
        status = 'pending'::community_request_status AND
        reviewed_by_staff_id IS NULL AND
        review_notes IS NULL AND
        created_community_id IS NULL
    );

CREATE POLICY "community_requests_update_staff_only"
    ON public.community_requests FOR UPDATE
    TO authenticated
    USING (public.is_staff_or_admin())
    WITH CHECK (public.is_staff_or_admin());

-- =============================================================================
-- RLS 7: GROUP CARTS
-- =============================================================================
CREATE POLICY "carts_select_community_members"
    ON public.group_carts FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.community_memberships cm
            WHERE cm.community_id = group_carts.community_id
              AND cm.user_id = auth.uid()
        ) OR public.is_staff_or_admin()
    );

CREATE POLICY "carts_insert_community_members"
    ON public.group_carts FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = created_by_user_id AND
        EXISTS (
            SELECT 1 FROM public.community_memberships cm
            WHERE cm.community_id = group_carts.community_id
              AND cm.user_id = auth.uid()
        )
    );

CREATE POLICY "carts_update_host_only"
    ON public.group_carts FOR UPDATE
    TO authenticated
    USING (created_by_user_id = auth.uid() OR public.is_staff_or_admin())
    WITH CHECK (created_by_user_id = auth.uid() OR public.is_staff_or_admin());

-- =============================================================================
-- RLS 8: CART PARTICIPANTS
-- =============================================================================
CREATE POLICY "cart_participants_select"
    ON public.cart_participants FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.group_carts gc
            JOIN public.community_memberships cm ON cm.community_id = gc.community_id
            WHERE gc.id = cart_participants.cart_id
              AND cm.user_id = auth.uid()
        )
    );

CREATE POLICY "cart_participants_insert_self"
    ON public.cart_participants FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.group_carts gc
            JOIN public.community_memberships cm ON cm.community_id = gc.community_id
            WHERE gc.id = cart_id
              AND cm.user_id = auth.uid()
              AND gc.status = 'open'::group_cart_status
              AND gc.lock_at > now()
        )
    );

CREATE POLICY "cart_participants_delete_self"
    ON public.cart_participants FOR DELETE
    TO authenticated
    USING (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.group_carts gc
            WHERE gc.id = cart_id
              AND gc.status = 'open'::group_cart_status
              AND gc.lock_at > now()
        )
    );

-- =============================================================================
-- RLS 9: CART ITEMS (FOREIGN KEYS PROTECTED VIA COLUMN PRIVILEGES)
-- =============================================================================
CREATE POLICY "cart_items_select"
    ON public.cart_items FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.group_carts gc
            JOIN public.community_memberships cm ON cm.community_id = gc.community_id
            WHERE gc.id = cart_items.cart_id
              AND cm.user_id = auth.uid()
        )
    );

CREATE POLICY "cart_items_insert_participants"
    ON public.cart_items FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = added_by_user_id AND
        EXISTS (
            SELECT 1 FROM public.cart_participants cp
            WHERE cp.cart_id = cart_items.cart_id
              AND cp.user_id = auth.uid()
        )
    );

-- Notice: Ineffective self-comparison removed. Column-level privilege revokes on cart_id & added_by_user_id
-- prevent foreign key drift directly at the engine level.
CREATE POLICY "cart_items_update_owner_only"
    ON public.cart_items FOR UPDATE
    TO authenticated
    USING (added_by_user_id = auth.uid())
    WITH CHECK (added_by_user_id = auth.uid());

CREATE POLICY "cart_items_delete_owner_or_host"
    ON public.cart_items FOR DELETE
    TO authenticated
    USING (
        added_by_user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.group_carts gc
            WHERE gc.id = cart_items.cart_id
              AND gc.created_by_user_id = auth.uid()
        )
    );

-- =============================================================================
-- RLS 10: CART MESSAGES (DEDICATED CHAT)
-- =============================================================================
CREATE POLICY "cart_messages_select_members_only"
    ON public.cart_messages FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.group_carts gc
            WHERE gc.id = cart_messages.cart_id
              AND gc.created_by_user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM public.cart_participants cp
            WHERE cp.cart_id = cart_messages.cart_id
              AND cp.user_id = auth.uid()
        ) OR public.is_staff_or_admin()
    );

CREATE POLICY "cart_messages_insert_members_only"
    ON public.cart_messages FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_id = auth.uid() AND (
            EXISTS (
                SELECT 1 FROM public.group_carts gc
                WHERE gc.id = cart_messages.cart_id
                  AND gc.created_by_user_id = auth.uid()
            ) OR
            EXISTS (
                SELECT 1 FROM public.cart_participants cp
                WHERE cp.cart_id = cart_messages.cart_id
                  AND cp.user_id = auth.uid()
            )
        )
    );

-- =============================================================================
-- RLS 11: SHARED RIDES
-- =============================================================================
CREATE POLICY "shared_rides_select_community_members"
    ON public.shared_rides FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.community_memberships cm
            WHERE cm.community_id = shared_rides.community_id
              AND cm.user_id = auth.uid()
        ) OR public.is_staff_or_admin()
    );

CREATE POLICY "shared_rides_insert_community_members"
    ON public.shared_rides FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = created_by_user_id AND
        EXISTS (
            SELECT 1 FROM public.community_memberships cm
            WHERE cm.community_id = shared_rides.community_id
              AND cm.user_id = auth.uid()
        )
    );

CREATE POLICY "shared_rides_update_host_only"
    ON public.shared_rides FOR UPDATE
    TO authenticated
    USING (created_by_user_id = auth.uid() OR public.is_staff_or_admin())
    WITH CHECK (created_by_user_id = auth.uid() OR public.is_staff_or_admin());

-- =============================================================================
-- RLS 12: RIDE PARTICIPANTS (DIRECT TABLE MUTATIONS FULLY REVOKED)
-- =============================================================================
CREATE POLICY "ride_participants_select"
    ON public.ride_participants FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.shared_rides sr
            WHERE sr.id = ride_participants.ride_id
              AND sr.created_by_user_id = auth.uid()
        ) OR public.is_staff_or_admin()
    );

-- Direct client updates/inserts/deletes are omitted. Table-level privileges are revoked.
-- All transitions happen through request_ride_seats, accept_ride_participant,
-- decline_ride_participant, and cancel_ride_reservation.

-- =============================================================================
-- RLS 13: RIDE MESSAGES (DEDICATED CHAT)
-- =============================================================================
CREATE POLICY "ride_messages_select_accepted_only"
    ON public.ride_messages FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.shared_rides sr
            WHERE sr.id = ride_messages.ride_id
              AND sr.created_by_user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM public.ride_participants rp
            WHERE rp.ride_id = ride_messages.ride_id
              AND rp.user_id = auth.uid()
              AND rp.status = 'accepted'::ride_participant_status
        ) OR public.is_staff_or_admin()
    );

CREATE POLICY "ride_messages_insert_accepted_only"
    ON public.ride_messages FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_id = auth.uid() AND (
            EXISTS (
                SELECT 1 FROM public.shared_rides sr
                WHERE sr.id = ride_messages.ride_id
                  AND sr.created_by_user_id = auth.uid()
            ) OR
            EXISTS (
                SELECT 1 FROM public.ride_participants rp
                WHERE rp.ride_id = ride_messages.ride_id
                  AND rp.user_id = auth.uid()
                  AND rp.status = 'accepted'::ride_participant_status
            )
        )
    );

-- =============================================================================
-- RLS 14: NOTIFICATIONS
-- =============================================================================
CREATE POLICY "notifications_select_self"
    ON public.notifications FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Direct updates are restricted exclusively to is_read
CREATE POLICY "notifications_update_self_read_only"
    ON public.notifications FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid() AND is_read = true);
```

---

## 8. Concurrency Scenarios & PostgreSQL Locking Behavior Proofs

The locking hierarchy enforces strict linear acquisition:  
$$\text{Level 1: } \texttt{public.shared_rides} \prec \text{Level 2: } \texttt{public.ride_participants}$$  
$$\text{Level 1: } \texttt{public.group_carts} \prec \text{Level 2: } \texttt{public.cart_items}$$

### Scenario 1: Ride Request versus Ride Closure / Cancellation
* **Initial State:** `shared_rides` has `status = 'open'`. Host decides to cancel the ride (`$T_1$`); simultaneously, a student submits a reservation request (`$T_2$`).
* **PostgreSQL Engine Locking:**
  1. `$T_1$` executes: `UPDATE public.shared_rides SET status = 'cancelled' WHERE id = 'ride-1'`.  
     PostgreSQL acquires an exclusive **`FOR NO KEY UPDATE`** row lock on the `shared_rides` tuple.
  2. `$T_2$` invokes: `request_ride_seats('ride-1', 1)`.  
     Inside the function, it executes: `SELECT available_seats, status, departure_time, created_by_user_id FROM public.shared_rides WHERE id = 'ride-1' FOR SHARE;`
  3. Under PostgreSQL's lock matrix, **`FOR SHARE` strictly conflicts with `FOR NO KEY UPDATE`**.
  4. `$T_2$` is placed into a `lock_wait` state on the tuple until `$T_1$` completes.
  5. `$T_1$` commits `status = 'cancelled'`.
  6. `$T_2$` unblocks. Under `READ COMMITTED`, it re-reads the committed row where `v_status = 'cancelled'`.
  7. The condition `IF v_status != 'open'::shared_ride_status` evaluates to `TRUE`, and `$T_2$` immediately raises: `RAISE EXCEPTION 'Ride is no longer accepting reservation requests.'`.
* **Guarantee:** Zero pending requests can register after a ride has been closed or cancelled.

---

### Scenario 2: Simultaneous Ride Acceptance on Final Seat
* **Initial State:** `available_seats = 1`. Two riders ($R_1, R_2$) are pending. The host clicks accept on both concurrently in two active tabs ($T_1, T_2$).
* **PostgreSQL Engine Locking:**
  1. `$T_1$` invokes: `accept_ride_participant(ride-1, R_1)`.  
     Executes: `SELECT available_seats FROM shared_rides WHERE id = 'ride-1' FOR UPDATE;`  
     Acquires exclusive Level 1 row lock. Reads `available_seats = 1`.
  2. `$T_2$` invokes: `accept_ride_participant(ride-1, R_2)`.  
     Executes: `SELECT available_seats FROM shared_rides WHERE id = 'ride-1' FOR UPDATE;`  
     Blocks waiting on `$T_1$`'s Level 1 lock.
  3. `$T_1$` locks Level 2 ($R_1$'s participant row), updates status to `'accepted'`, decrements `available_seats = 0`, and commits.
  4. `$T_2$` unblocks. Under `FOR UPDATE`, it re-reads the committed tuple: `v_available = 0`.
  5. `$T_2$` evaluates: `IF v_available < v_seats_requested (0 < 1)` $\rightarrow$ raises exception: `RAISE EXCEPTION 'Cannot accept: Available seats (0) less than requested (1).'`.
* **Guarantee:** Concurrency is serialized; seat inventory can never be overbooked or become negative.

---

### Scenario 3: Ride Acceptance versus Concurrent Rider Cancellation
* **Initial State:** Rider $R_1$ is pending with 2 seats requested. The host attempts to accept ($T_1$), while $R_1$ simultaneously cancels ($T_2$).
* **PostgreSQL Engine Locking:**
  1. Both functions follow the strict lock order: `shared_rides` (Level 1) $\rightarrow$ `ride_participants` (Level 2).
  2. Whichever transaction acquires `shared_rides FOR UPDATE` first proceeds; the second transaction waits on Level 1.
  3. If $T_1$ (Accept) commits first: $R_1$ becomes `'accepted'`. When $T_2$ (Cancel) unblocks, it reads `status = 'accepted'`, marks status as `'cancelled'`, and restores the 2 seats.
  4. If $T_2$ (Cancel) commits first: $R_1$ becomes `'cancelled'`. When $T_1$ (Accept) unblocks, it reads `v_current_status = 'cancelled'`, evaluates `IF v_current_status != 'pending'`, and raises exception: `RAISE EXCEPTION 'Cannot accept request in status: cancelled'`.
* **Guarantee:** Deadlock-free; no phantom seats created.

---

### Scenario 4: Ride Acceptance versus Host Decline
* **Initial State:** Host attempts to decline in Tab 1 ($T_1$) while clicking accept in Tab 2 ($T_2$) for the same applicant.
* **PostgreSQL Engine Locking:**
  1. Both functions execute `SELECT ... FROM shared_rides WHERE id = ... FOR UPDATE` as Step 1.
  2. $T_1$ proceeds, locks participant row, verifies `status = 'pending'`, sets `status = 'declined'`, and commits.
  3. $T_2$ unblocks, reads `status = 'declined'`, verifies `v_current_status != 'pending'`, and raises exception.
* **Guarantee:** Clean mutual exclusion without race conditions.

---

### Scenario 5: Cart Closure versus Concurrent Item Insertion
* **Initial State:** `group_carts` has `status = 'open'`. Host locks the cart ($T_1$); student submits grocery item ($T_2$).
* **PostgreSQL Engine Locking:**
  1. $T_1$ executes: `UPDATE group_carts SET status = 'locked' WHERE id = 'cart-1'` (acquires `FOR NO KEY UPDATE`).
  2. $T_2$ executes: `INSERT INTO cart_items ...`  
     Trigger `trg_enforce_cart_item_lock` fires `BEFORE INSERT` and executes: `SELECT status, lock_at FROM group_carts WHERE id = 'cart-1' FOR SHARE;`
  3. Under PostgreSQL, **`FOR SHARE` conflicts with `FOR NO KEY UPDATE`**.
  4. $T_2$ waits for $T_1$ to commit.
  5. Upon commit, $T_2$ unblocks, reads `status = 'locked'`, and aborts with `Cart is locked or closed.`
* **Guarantee:** Zero items can be written into a closed cart.

---

### Scenario 6: Duplicate Concurrent Ride Requests from Same Student
* **Initial State:** Student clicks "Request Seat" rapidly in two browser windows simultaneously ($T_1, T_2$).
* **PostgreSQL Engine Locking:**
  1. Both transactions acquire `shared_rides FOR SHARE` (shared locks are mutually compatible).
  2. Both execute: `INSERT INTO ride_participants (ride_id, user_id, ...) VALUES (...) ON CONFLICT (ride_id, user_id) DO UPDATE ...`
  3. PostgreSQL forces $T_2$ to wait on the tuple lock of the unique index on `(ride_id, user_id)`.
  4. $T_1$ inserts a new row and commits.
  5. $T_2$ wakes up on the existing row. Because the existing row has `status = 'pending'`, the clause `WHERE ride_participants.status IN ('declined', 'cancelled')` evaluates to `FALSE`.
  6. $T_2$ updates 0 rows (`NOT FOUND` is true), detects `v_existing_status = 'pending'`, and raises exception: `RAISE EXCEPTION 'A pending seat request is already active for this ride.'`
  7. $T_2$ rolls back completely; zero duplicate notifications are created.
* **Guarantee:** Guaranteed single reservation request per student per ride.

---

## 9. Comprehensive SQL Security Test Harness (v1.2 Specification)

> **Execution Protocol Notice:**  
> **STATUS: Documented — Not Executed — Pending Independent Verification**  
> This test harness is a rigorous engineering specification designed for validation against an isolated local PostgreSQL 15 / Supabase CLI test environment. In strict compliance with operational boundaries, zero migrations, zero database modifications, and zero tests have been executed on live infrastructure in this phase.

---

### 9.1 Recommended Local Test Environment (Docker / Supabase CLI)

To verify the SQL security and concurrency behavior without requiring production Supabase credentials or risking live data:

#### Option A: Disposable Local Supabase Environment (Recommended)
Using the official Supabase CLI, engineers spin up an isolated local stack running PostgreSQL 15, Auth, and PostgREST in Docker:
```bash
# 1. Initialize local Supabase configuration
supabase init

# 2. Start local disposable containers
supabase start

# 3. Connection endpoint (disposable local instance):
# postgresql://postgres:postgres@localhost:54322/postgres

# 4. Execute DDL and Test Harness in local sandbox:
psql -h localhost -p 54322 -U postgres -d postgres -f docs/ARCHITECTURE.md

# 5. Stop and destroy local test environment:
supabase stop
```

#### Option B: Standalone PostgreSQL 15 Docker Container with Mock Auth Schema
For automated CI pipelines or lightweight testing without full Supabase services:
```bash
# 1. Launch vanilla PostgreSQL 15 container
docker run --name yuvnix-test-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:15

# 2. Apply mock Supabase auth schema and session helper functions
```
```sql
-- Minimal mock auth schema for local testing
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE,
    raw_user_meta_data JSONB
);

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text;
$$;

-- Create PostgREST client role
CREATE ROLE authenticated NOLOGIN NOINHERIT;
GRANT USAGE ON SCHEMA public TO authenticated;
```

---

### 9.2 Authentication Context & Role Simulation Protocol

In Supabase, client API requests through PostgREST execute under the PostgreSQL database role `authenticated`. If tests run as the default superuser (`postgres`), PostgreSQL bypasses all Row Level Security (RLS) policies and table grants. Therefore, all test blocks execute under explicit role simulation:

1. **Role Context:** Every test transaction executes `SET LOCAL ROLE authenticated;`, discarding superuser privileges for the transaction.
2. **JWT Claims Injection:** PostgREST passes JWT claims through PostgreSQL session settings. Tests inject these claims via `request.jwt.claim.sub` and `request.jwt.claims`.
3. **Session Verification:** Tests verify `auth.uid()` derivation immediately after configuration. If `auth.uid()` does not match the target fixture UUID, the test aborts.
4. **Support Staff Simulation:** In Yuvnix, support staff are not a separate PostgreSQL role; they connect as `authenticated` with `public.profiles.role = 'support_staff'`. Functions such as `public.is_staff_or_admin()` query `public.profiles` for `auth.uid()` to verify administrative authority.
5. **Automatic Teardown:** Every test runs inside an isolated `BEGIN ... ROLLBACK;` transaction block, ensuring zero persistent mutations during test evaluation.

```sql
-- Standard User Session Simulation Template
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SET LOCAL "request.jwt.claims" = jsonb_build_object(
    'sub', '11111111-1111-1111-1111-111111111111',
    'role', 'authenticated'
)::text;

-- Verification of auth.uid()
DO $$
BEGIN
    IF auth.uid() != '11111111-1111-1111-1111-111111111111'::uuid THEN
        RAISE EXCEPTION 'Authentication simulation failure: auth.uid() is %, expected 11111111-1111-1111-1111-111111111111', auth.uid();
    END IF;
END $$;
...
ROLLBACK;
```

---

### 9.3 Test Fixtures Setup & Teardown Protocol

Fixtures are provisioned by the `postgres` administrator prior to executing the test suite to ensure tests evaluate security controls rather than missing-row errors.

#### Deterministic Fixture Inventory
* **Student A (`usr_student_a`):** `11111111-1111-1111-1111-111111111111` (`role: 'student'`), Phone: `+919876543210`
* **Student B (`usr_student_b`):** `22222222-2222-2222-2222-222222222222` (`role: 'student'`), Phone: `+919876543211`
* **Student C (`usr_student_c`):** `44444444-4444-4444-4444-444444444444` (`role: 'student'`), Phone: `+919876543213`
* **Support Staff (`usr_staff`):** `33333333-3333-3333-3333-333333333333` (`role: 'support_staff'`), Reviewer account
* **Verified Community (`comm_verified`):** `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa` ("PDEU Hostel Block A", `is_verified: true`)
  * **Verified Pickup Point:** `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01` ("Gate 1 Security Desk", "Gate 1 Circle Curb")
  * **Membership:** Student A is an active resident (`is_active: true`).
* **Non-Member Community (`comm_other`):** `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb` ("Sunrise PG", `is_verified: true`)
  * **Non-Member Pickup Point:** `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01` ("Front Porch", "Main Road Gate")
  * **Membership:** Student B is an active resident (`is_active: true`). *(Student A is explicitly NOT a member)*.
* **Open Cart (`cart_open`):** `cccccccc-cccc-cccc-cccc-cccccccccccc` (Host: Student A, `status: 'open'`, `lock_at: now() + interval '2 hours'`)
  * **Cart Participant:** Student A (Host)
  * **Cart Item:** `cccccccc-cccc-cccc-cccc-cccccccccc01` ("Organic Milk", added by Student A)
* **Locked Cart (`cart_locked`):** `dddddddd-dddd-dddd-dddd-dddddddddddd` (Host: Student A, `status: 'locked'`, `lock_at: now() - interval '10 minutes'`)
* **Ride with 1 Seat Available (`ride_active`):** `eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee` (Host: Student A, `total_seats: 4`, `available_seats: 1`, `status: 'open'`, `departure_time: now() + interval '4 hours'`)
  * **Pending Participant:** Student B (`seats_reserved: 1`, `status: 'pending'`)
* **Ride for Cancellation Tests (`ride_canc`):** `ffffffff-ffff-ffff-ffff-ffffffffffff` (Host: Student A, `total_seats: 4`, `available_seats: 2`, `status: 'open'`, `departure_time: now() + interval '4 hours'`)
  * **Pending Participant:** Student B (`seats_reserved: 1`, `status: 'pending'`)
* **Pending Community Request (`req_pending`):** `77777777-7777-7777-7777-777777777777` (Requested by Student A, `status: 'pending'`)

```sql
-- =============================================================================
-- FIXTURE PROVISIONING SCRIPT (Execute as superuser / postgres)
-- =============================================================================
BEGIN;

-- 1. Profiles & Private Profiles
INSERT INTO public.profiles (id, full_name, role) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Alice Student', 'student'),
    ('22222222-2222-2222-2222-222222222222', 'Bob Student', 'student'),
    ('44444444-4444-4444-4444-444444444444', 'Charlie Student', 'student'),
    ('33333333-3333-3333-3333-333333333333', 'Carol Staff', 'support_staff')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profile_private (id, email, phone_number) VALUES
    ('11111111-1111-1111-1111-111111111111', 'alice@test.yuvnix.in', '+919876543210'),
    ('22222222-2222-2222-2222-222222222222', 'bob@test.yuvnix.in', '+919876543211'),
    ('44444444-4444-4444-4444-444444444444', 'charlie@test.yuvnix.in', '+919876543213'),
    ('33333333-3333-3333-3333-333333333333', 'carol@staff.yuvnix.in', '+919876543212')
ON CONFLICT (id) DO NOTHING;

-- 2. Communities & Pickup Points
INSERT INTO public.communities (id, name, slug, type, city, is_verified) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'PDEU Hostel Block A', 'pdeu-hostel-a', 'hostel', 'Gandhinagar', true),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Sunrise PG', 'sunrise-pg', 'pg', 'Gandhinagar', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.community_pickup_points (id, community_id, physical_address, delivery_pickup_point, taxi_pickup_point) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Knowledge Corridor, Raisan', 'Gate 1 Security Desk', 'Gate 1 Circle Curb'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Near Bhaijipura Crossroad', 'Front Porch', 'Main Road Gate')
ON CONFLICT (id) DO NOTHING;

-- 3. Community Memberships
INSERT INTO public.community_memberships (community_id, user_id, is_active) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', true), -- Alice in PDEU Hostel
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', true)  -- Bob in Sunrise PG
ON CONFLICT (community_id, user_id) DO NOTHING;

-- 4. Group Grocery Carts
INSERT INTO public.group_carts (id, community_id, created_by_user_id, title, store_name, status, lock_at) VALUES
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Snacks Order', 'Blinkit', 'open', now() + interval '2 hours'),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Late Night Munches', 'Zepto', 'locked', now() - interval '10 minutes')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.cart_participants (cart_id, user_id) VALUES
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (cart_id, user_id) DO NOTHING;

INSERT INTO public.cart_items (id, cart_id, added_by_user_id, item_name, quantity, unit_price_estimate) VALUES
    ('cccccccc-cccc-cccc-cccc-cccccccccc01', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Organic Milk', 2, 65.00)
ON CONFLICT (id) DO NOTHING;

-- 5. Shared Rides
INSERT INTO public.shared_rides (id, community_id, created_by_user_id, pickup_point, destination, departure_time, total_seats, available_seats, status) VALUES
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Gate 1 Circle Curb', 'SVP Airport Terminal 2', now() + interval '4 hours', 4, 1, 'open'),
    ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Gate 1 Circle Curb', 'Kalupur Railway Station', now() + interval '4 hours', 4, 2, 'open')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ride_participants (ride_id, user_id, seats_reserved, status) VALUES
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222', 1, 'pending'),
    ('ffffffff-ffff-ffff-ffff-ffffffffffff', '22222222-2222-2222-2222-222222222222', 1, 'pending')
ON CONFLICT (ride_id, user_id) DO NOTHING;

-- 6. Pending Community Request
INSERT INTO public.community_requests (id, requested_by_user_id, proposed_name, proposed_type, proposed_address, proposed_delivery_pickup_point, proposed_taxi_pickup_point, status)
VALUES ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', 'Proposed Hostel', 'hostel', 'Sector 7', 'Main Gate', 'Main Gate', 'pending')
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- =============================================================================
-- FIXTURE TEARDOWN SCRIPT
-- =============================================================================
/*
DELETE FROM public.profiles WHERE id IN (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '44444444-4444-4444-4444-444444444444',
    '33333333-3333-3333-3333-333333333333'
);
DELETE FROM public.communities WHERE id IN (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
);
*/
```

---

### 9.4 Comprehensive Security Control Test Suite (TEST-SEC-01 to SEC-10B)

#### TEST-SEC-01: Student Role Escalation
* **Operation:** Student A attempts `UPDATE public.profiles SET role = 'support_staff' WHERE id = '11111111-1111-1111-1111-111111111111'`.
* **Expected Enforcement & SQLSTATE:**
  * *Primary Layer:* PostgreSQL column-level privilege check. Column `role` is omitted from `GRANT UPDATE (full_name, avatar_url) ON profiles TO authenticated`. Rejected with **`42501`** (`insufficient_privilege`).
  * *Defense-in-Depth Layer:* Trigger `trg_prevent_role_escalation` fires `BEFORE UPDATE OF role` and throws exception with **`P0001`** (`raise_exception`).
```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

DO $$
DECLARE
    v_succeeded BOOLEAN := false;
    v_sqlstate TEXT;
BEGIN
    BEGIN
        UPDATE public.profiles 
        SET role = 'support_staff'::user_role 
        WHERE id = '11111111-1111-1111-1111-111111111111';
        v_succeeded := true;
    EXCEPTION
        WHEN insufficient_privilege OR raise_exception THEN
            v_sqlstate := SQLSTATE;
    END;

    IF v_succeeded THEN
        RAISE EXCEPTION 'TEST-SEC-01 FAILED: Student role escalation succeeded!';
    END IF;

    RAISE NOTICE 'TEST-SEC-01 PASSED: Role escalation blocked with SQLSTATE %', v_sqlstate;
END $$;
ROLLBACK;
```

#### TEST-SEC-02: Community Pickup-Point Privacy (Positive & Negative Controls)
* **Operation:** Student A queries `community_pickup_points` for their joined community and an unjoined community.
* **Enforcement Layer:** RLS policy `pickup_points_select_members_only`.
* **Controls:**
  1. *Positive Control:* Student A reads their own community coordinates (`comm_verified`). Query returns **exactly 1 row** matching fixture values (`Gate 1 Security Desk`, `Gate 1 Circle Curb`).
  2. *Negative Control:* Student A reads `comm_other` coordinates. Query returns **exactly 0 rows**.
```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

DO $$
DECLARE
    v_delivery TEXT;
    v_taxi TEXT;
    v_unauthorized_count INT;
BEGIN
    -- 1. Positive Control: Active member must retrieve their community pickup point
    SELECT delivery_pickup_point, taxi_pickup_point 
    INTO v_delivery, v_taxi
    FROM public.community_pickup_points 
    WHERE community_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

    IF v_delivery IS NULL OR v_taxi IS NULL THEN
        RAISE EXCEPTION 'TEST-SEC-02 FAILED: Positive control failed; active member received 0 rows from joined community!';
    END IF;

    IF v_delivery != 'Gate 1 Security Desk' OR v_taxi != 'Gate 1 Circle Curb' THEN
        RAISE EXCEPTION 'TEST-SEC-02 FAILED: Positive control returned unexpected data: % / %', v_delivery, v_taxi;
    END IF;

    -- 2. Negative Control: Non-member must receive 0 rows
    SELECT count(*) INTO v_unauthorized_count 
    FROM public.community_pickup_points 
    WHERE community_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

    IF v_unauthorized_count > 0 THEN
        RAISE EXCEPTION 'TEST-SEC-02 FAILED: Negative control breached; non-member read % rows from unjoined community!', v_unauthorized_count;
    END IF;

    RAISE NOTICE 'TEST-SEC-02 PASSED: Positive control matched exact fixture; negative control returned 0 rows.';
END $$;
ROLLBACK;
```

#### TEST-SEC-03: Cart Chat Access Isolation
* **Operation:** Student B (non-participant in `cart_open`) attempts `INSERT INTO cart_messages`.
* **Enforcement Layer:** RLS policy `cart_messages_insert_members_only` `WITH CHECK`.
* **Expected SQLSTATE:** **`42501`** (`insufficient_privilege`).
```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';

DO $$
DECLARE
    v_succeeded BOOLEAN := false;
    v_sqlstate TEXT;
BEGIN
    BEGIN
        INSERT INTO public.cart_messages (cart_id, sender_id, message_text)
        VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'Infiltrating cart chat');
        v_succeeded := true;
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_sqlstate := SQLSTATE;
    END;

    IF v_succeeded THEN
        RAISE EXCEPTION 'TEST-SEC-03 FAILED: Non-participant sent message to private cart chat!';
    END IF;

    RAISE NOTICE 'TEST-SEC-03 PASSED: Unauthorized cart message blocked with SQLSTATE %', v_sqlstate;
END $$;
ROLLBACK;
```

#### TEST-SEC-04: Ride Chat Access Isolation
* **Operation:** Student B (status `pending` on `ride_active`) attempts to read and post in `ride_messages`.
* **Enforcement Layer:** RLS policies `ride_messages_select_accepted_only` and `ride_messages_insert_accepted_only`.
* **Expected Result:** SELECT returns **0 rows**; INSERT rejected with SQLSTATE **`42501`** (`insufficient_privilege`).
```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';

DO $$
DECLARE
    v_succeeded BOOLEAN := false;
    v_count INT;
    v_sqlstate TEXT;
BEGIN
    SELECT count(*) INTO v_count 
    FROM public.ride_messages 
    WHERE ride_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

    IF v_count > 0 THEN
        RAISE EXCEPTION 'TEST-SEC-04 FAILED: Pending rider was able to read ride messages!';
    END IF;

    BEGIN
        INSERT INTO public.ride_messages (ride_id, sender_id, message_text)
        VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222', 'Pending rider message');
        v_succeeded := true;
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_sqlstate := SQLSTATE;
    END;

    IF v_succeeded THEN
        RAISE EXCEPTION 'TEST-SEC-04 FAILED: Pending rider posted message into ride chat!';
    END IF;

    RAISE NOTICE 'TEST-SEC-04 PASSED: Pending rider read returned 0 rows; write blocked with SQLSTATE %', v_sqlstate;
END $$;
ROLLBACK;
```

#### TEST-SEC-05: Direct Mutations on `ride_participants`
* **Operation:** Student B attempts direct table `INSERT`, `UPDATE`, and `DELETE` on `ride_participants`.
* **Enforcement Layer:** Table privilege revocation (`REVOKE ALL ON public.ride_participants FROM PUBLIC, anon; GRANT SELECT ON public.ride_participants TO authenticated;`).
* **Expected SQLSTATE:** **`42501`** (`insufficient_privilege`).
```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';

DO $$
DECLARE
    v_insert_ok BOOLEAN := false;
    v_update_ok BOOLEAN := false;
    v_delete_ok BOOLEAN := false;
BEGIN
    BEGIN
        INSERT INTO public.ride_participants (ride_id, user_id, seats_reserved, status)
        VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '22222222-2222-2222-2222-222222222222', 1, 'accepted');
        v_insert_ok := true;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;

    BEGIN
        UPDATE public.ride_participants 
        SET status = 'accepted'::ride_participant_status 
        WHERE ride_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' AND user_id = '22222222-2222-2222-2222-222222222222';
        v_update_ok := true;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;

    BEGIN
        DELETE FROM public.ride_participants 
        WHERE ride_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' AND user_id = '22222222-2222-2222-2222-222222222222';
        v_delete_ok := true;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;

    IF v_insert_ok OR v_update_ok OR v_delete_ok THEN
        RAISE EXCEPTION 'TEST-SEC-05 FAILED: Direct table mutation succeeded on ride_participants (I:%, U:%, D:%)', v_insert_ok, v_update_ok, v_delete_ok;
    END IF;

    RAISE NOTICE 'TEST-SEC-05 PASSED: Direct INSERT, UPDATE, and DELETE rejected with SQLSTATE 42501.';
END $$;
ROLLBACK;
```

#### TEST-SEC-06: Cart Item `cart_id` Foreign Key Tampering
* **Operation:** Student A attempts to reassign their added item to another cart via direct UPDATE.
* **Enforcement Layer:** Column privilege revocation on `cart_id`.
* **Expected SQLSTATE:** **`42501`** (`insufficient_privilege`).
```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

DO $$
DECLARE
    v_succeeded BOOLEAN := false;
    v_sqlstate TEXT;
BEGIN
    BEGIN
        UPDATE public.cart_items 
        SET cart_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' 
        WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccc01';
        v_succeeded := true;
    EXCEPTION WHEN insufficient_privilege THEN
        v_sqlstate := SQLSTATE;
    END;

    IF v_succeeded THEN
        RAISE EXCEPTION 'TEST-SEC-06 FAILED: cart_id was modified via UPDATE!';
    END IF;

    RAISE NOTICE 'TEST-SEC-06 PASSED: cart_id modification rejected with SQLSTATE %', v_sqlstate;
END $$;
ROLLBACK;
```

#### TEST-SEC-07: Cart Item `added_by_user_id` Tampering
* **Operation:** Student A attempts to alter ownership of an item by setting `added_by_user_id` to Student B.
* **Enforcement Layer:** Column privilege revocation on `added_by_user_id`.
* **Expected SQLSTATE:** **`42501`** (`insufficient_privilege`).
```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

DO $$
DECLARE
    v_succeeded BOOLEAN := false;
    v_sqlstate TEXT;
BEGIN
    BEGIN
        UPDATE public.cart_items 
        SET added_by_user_id = '22222222-2222-2222-2222-222222222222' 
        WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccc01';
        v_succeeded := true;
    EXCEPTION WHEN insufficient_privilege THEN
        v_sqlstate := SQLSTATE;
    END;

    IF v_succeeded THEN
        RAISE EXCEPTION 'TEST-SEC-07 FAILED: added_by_user_id was modified via UPDATE!';
    END IF;

    RAISE NOTICE 'TEST-SEC-07 PASSED: added_by_user_id modification rejected with SQLSTATE %', v_sqlstate;
END $$;
ROLLBACK;
```

#### TEST-SEC-08: Notification Forgery
* **Operation:** Student A attempts direct SQL `INSERT INTO public.notifications`.
* **Enforcement Layer:** Table privilege revocation.
* **Expected SQLSTATE:** **`42501`** (`insufficient_privilege`).
```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

DO $$
DECLARE
    v_succeeded BOOLEAN := false;
    v_sqlstate TEXT;
BEGIN
    BEGIN
        INSERT INTO public.notifications (user_id, type, title, body)
        VALUES ('22222222-2222-2222-2222-222222222222', 'ride_seat_accepted', 'Forged Confirmed Ride', 'Fake notification');
        v_succeeded := true;
    EXCEPTION WHEN insufficient_privilege THEN
        v_sqlstate := SQLSTATE;
    END;

    IF v_succeeded THEN
        RAISE EXCEPTION 'TEST-SEC-08 FAILED: Direct notification insert succeeded!';
    END IF;

    RAISE NOTICE 'TEST-SEC-08 PASSED: Direct notification creation blocked with SQLSTATE %', v_sqlstate;
END $$;
ROLLBACK;
```

#### TEST-SEC-09: Notification Title and Body Modification
* **Operation:** Student A attempts to modify the title or body of a received notification.
* **Enforcement Layer:** Column privilege revocation on `title` and `body`.
* **Expected SQLSTATE:** **`42501`** (`insufficient_privilege`).
```sql
BEGIN;
SET ROLE postgres;
INSERT INTO public.notifications (id, user_id, type, title, body)
VALUES ('99999999-9999-9999-9999-999999999999', '11111111-1111-1111-1111-111111111111', 'cart_lock_imminent', 'Test Alert', 'Original Content')
ON CONFLICT (id) DO NOTHING;

SET ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

DO $$
DECLARE
    v_succeeded BOOLEAN := false;
    v_sqlstate TEXT;
BEGIN
    BEGIN
        UPDATE public.notifications 
        SET title = 'Tampered Alert Title', body = 'Malicious Content'
        WHERE id = '99999999-9999-9999-9999-999999999999';
        v_succeeded := true;
    EXCEPTION WHEN insufficient_privilege THEN
        v_sqlstate := SQLSTATE;
    END;

    IF v_succeeded THEN
        RAISE EXCEPTION 'TEST-SEC-09 FAILED: Student modified notification title/body!';
    END IF;

    RAISE NOTICE 'TEST-SEC-09 PASSED: Title/body modification blocked with SQLSTATE %', v_sqlstate;
END $$;
ROLLBACK;
```

#### TEST-SEC-10A: Community Creation Governance (Fully Isolated Negative & Positive Blocks)
* **Design:** Tests student rejection and staff creation in two separate, independent transactions with deterministic pre-cleanup, ensuring repeated test runs never fail on duplicate slugs.

```sql
-- SUB-TEST 10A-1: Student Direct Creation Rejection (Isolated Transaction)
BEGIN;
SET ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111'; -- Alice Student

DO $$
DECLARE
    v_student_ok BOOLEAN := false;
BEGIN
    BEGIN
        INSERT INTO public.communities (name, slug, type, city)
        VALUES ('Student Rogue PG', 'staff-created-comm-test', 'pg', 'Gandhinagar');
        v_student_ok := true;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;

    IF v_student_ok THEN
        RAISE EXCEPTION 'TEST-SEC-10A-1 FAILED: Student directly created a community!';
    END IF;

    RAISE NOTICE 'TEST-SEC-10A-1 PASSED: Student community creation blocked with SQLSTATE 42501.';
END $$;
ROLLBACK;

-- SUB-TEST 10A-2: Support Staff Authorized Creation (Isolated Transaction)
BEGIN;
-- Deterministic pre-cleanup in case of dirty transaction state
DELETE FROM public.communities WHERE slug = 'staff-created-comm-test';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333'; -- Carol Staff
SET LOCAL "request.jwt.claims" = jsonb_build_object(
    'sub', '33333333-3333-3333-3333-333333333333',
    'role', 'authenticated'
)::text;

INSERT INTO public.communities (id, name, slug, type, city, is_verified)
VALUES ('88888888-8888-8888-8888-888888888888', 'Staff Verified Residence', 'staff-created-comm-test', 'hostel', 'Gandhinagar', true);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.communities WHERE slug = 'staff-created-comm-test') THEN
        RAISE EXCEPTION 'TEST-SEC-10A-2 FAILED: Staff insert did not persist in database!';
    END IF;
    RAISE NOTICE 'TEST-SEC-10A-2 PASSED: Authenticated staff member successfully created community.';
END $$;
ROLLBACK;
```

#### TEST-SEC-10B: Community Request Approval Governance (Fully Isolated Negative & Positive Blocks)
* **Design:** Tests student self-approval rejection and staff approval in separate transactions, ensuring the request remains pending for repeated test executions.

```sql
-- SUB-TEST 10B-1: Student Self-Approval Rejection (Isolated Transaction)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111'; -- Alice Student

DO $$
DECLARE
    v_rows_updated INT;
    v_status community_request_status;
BEGIN
    UPDATE public.community_requests 
    SET status = 'approved'::community_request_status 
    WHERE id = '77777777-7777-7777-7777-777777777777';
    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

    IF v_rows_updated > 0 THEN
        RAISE EXCEPTION 'TEST-SEC-10B-1 FAILED: Student self-approved their community request!';
    END IF;

    SELECT status INTO v_status FROM public.community_requests WHERE id = '77777777-7777-7777-7777-777777777777';
    IF v_status != 'pending'::community_request_status THEN
        RAISE EXCEPTION 'TEST-SEC-10B-1 FAILED: Request status mutated away from pending!';
    END IF;

    RAISE NOTICE 'TEST-SEC-10B-1 PASSED: Student update affected 0 rows; status remained pending.';
END $$;
ROLLBACK;

-- SUB-TEST 10B-2: Support Staff Authorized Approval (Isolated Transaction)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333'; -- Carol Staff
SET LOCAL "request.jwt.claims" = jsonb_build_object(
    'sub', '33333333-3333-3333-3333-333333333333',
    'role', 'authenticated'
)::text;

UPDATE public.community_requests 
SET status = 'approved'::community_request_status,
    reviewed_by_staff_id = '33333333-3333-3333-3333-333333333333'
WHERE id = '77777777-7777-7777-7777-777777777777';

DO $$
DECLARE
    v_status community_request_status;
BEGIN
    SELECT status INTO v_status FROM public.community_requests WHERE id = '77777777-7777-7777-7777-777777777777';
    IF v_status != 'approved'::community_request_status THEN
        RAISE EXCEPTION 'TEST-SEC-10B-2 FAILED: Staff approval failed to set status to approved!';
    END IF;
    RAISE NOTICE 'TEST-SEC-10B-2 PASSED: Authenticated staff member successfully approved request.';
END $$;
ROLLBACK;
```

---

### 9.5 Corrected Multi-Session Concurrency Test Suite (CONC-01 to CONC-07)

#### TEST-CONC-01: Two Different Students Requesting Same Ride Concurrently
* **Setup:** Ride `eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee` with 1 seat available. Student B and Student C request seats concurrently in Session 1 and Session 2.
* **Mechanism:** Both acquire `FOR SHARE` on `shared_rides` (compatible locks). Neither blocks the other. Because `user_id` values differ (`usr_student_b` vs `usr_student_c`), there is **no collision on `UNIQUE (ride_id, user_id)`**. Both requests insert with `status = 'pending'`.
```sql
-- SESSION 1 (Student B: 22222222-2222-2222-2222-222222222222)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
SELECT public.request_ride_seats('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 1);

-- SESSION 2 (Student C: 44444444-4444-4444-4444-444444444444)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '44444444-4444-4444-4444-444444444444';
SELECT public.request_ride_seats('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 1);

-- Both transactions commit independently
COMMIT; -- in Session 1
COMMIT; -- in Session 2
```
* **Expected Result:** Both requests register with `status = 'pending'`. Final seat allocation is resolved during host acceptance.

#### TEST-CONC-02: Same Student Rapid Double Request (Unique Constraint Serialization)
* **Setup:** Student B submits two requests for the same ride simultaneously in Session 1 and Session 2.
* **Mechanism:**
  1. Both sessions acquire `shared_rides FOR SHARE`.
  2. Both execute: `INSERT INTO ride_participants (ride_id, user_id, ...) VALUES (...) ON CONFLICT (ride_id, user_id) DO UPDATE ... WHERE ride_participants.status IN ('declined', 'cancelled')`.
  3. **`UNIQUE (ride_id, user_id)` forces serialization:** Session 2 waits on the unique index tuple lock held by Session 1.
  4. Session 1 completes the insert and commits `status = 'pending'`.
  5. Session 2 unblocks. The row exists with `status = 'pending'`, so the `WHERE status IN ('declined', 'cancelled')` condition evaluates to `FALSE`.
  6. Zero rows are updated (`NOT FOUND = true`).
  7. Session 2 evaluates `IF v_existing_status = 'pending'` and raises custom PL/pgSQL exception **`P0001`**: `RAISE EXCEPTION 'A pending seat request is already active for this ride.'`.
```sql
-- SESSION 1 (Student B, Tab 1)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
SELECT public.request_ride_seats('ffffffff-ffff-ffff-ffff-ffffffffffff', 1);

-- SESSION 2 (Student B, Tab 2)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
SELECT public.request_ride_seats('ffffffff-ffff-ffff-ffff-ffffffffffff', 1);
-- EXPECTED: Session 2 blocks on unique index tuple lock on (ride_id, user_id).

COMMIT; -- in Session 1
-- Session 2 unblocks, updates 0 rows, raises P0001: 'A pending seat request is already active for this ride.'
ROLLBACK; -- in Session 2
```

#### TEST-CONC-03: Two Host Sessions Accepting the Final Available Seat
* **Setup:** Ride `eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee` has `available_seats = 1`. Student B and Student C are pending. Host accepts Student B in Session 1 and Student C in Session 2.
* **Mechanism:** Serialized by Level 1 row lock (`shared_rides FOR UPDATE`). Session 1 locks Level 1, decrements `available_seats = 0`, sets status to `'full'`, and commits. Session 2 unblocks, re-reads committed `available_seats = 0`, detects `0 < 1`, and raises custom PL/pgSQL exception **`P0001`**: `Cannot accept: Available seats (0) less than requested (1)`.
```sql
-- SESSION 1 (Host Acceptance for Student B)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SELECT public.accept_ride_participant('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222');

-- SESSION 2 (Host Acceptance for Student C)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SELECT public.accept_ride_participant('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '44444444-4444-4444-4444-444444444444');
-- EXPECTED: Session 2 blocks on shared_rides FOR UPDATE (Level 1).

COMMIT; -- in Session 1
-- Session 2 unblocks, re-reads available_seats = 0, raises P0001:
-- ERROR: Cannot accept: Available seats (0) less than requested (1).
ROLLBACK; -- in Session 2
```

#### TEST-CONC-04: Ride Closure vs. New Seat Request Race
* **Setup:** Host cancels ride while student submits seat request.
* **Mechanism:** Session 1 executes `UPDATE shared_rides SET status = 'cancelled'` (acquires `FOR NO KEY UPDATE` on Level 1 tuple). Session 2 executes `SELECT ... FROM shared_rides FOR SHARE`. Under PostgreSQL, **`FOR SHARE` strictly conflicts with `FOR NO KEY UPDATE`**. Session 2 blocks until Session 1 commits. Upon unblocking, Session 2 re-reads committed `status = 'cancelled'` and raises custom PL/pgSQL exception **`P0001`**: `Ride is no longer accepting reservation requests.`.
```sql
-- SESSION 1 (Host cancels ride)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
UPDATE public.shared_rides SET status = 'cancelled'::shared_ride_status WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

-- SESSION 2 (Student requests seats)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '44444444-4444-4444-4444-444444444444';
SELECT public.request_ride_seats('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 1);
-- EXPECTED: Function requests FOR SHARE on Level 1. Conflicts with FOR NO KEY UPDATE. Session 2 blocks.

COMMIT; -- in Session 1
-- Session 2 unblocks, re-reads status = 'cancelled', raises P0001:
-- ERROR: Ride is no longer accepting reservation requests.
ROLLBACK; -- in Session 2
```

#### TEST-CONC-05A: Cancellation vs. Acceptance Race (Ordering 1: Host Accept Commits First)
* **Initial State:** Ride `ffffffff-ffff-ffff-ffff-ffffffffffff` (`total_seats = 4`, `available_seats = 2`). Student B is `status = 'pending'`, `seats_reserved = 1`.
* **Operations & Lock Sequences:**
  1. *Session 1 ($T_1$, Host Accept):*
     * Acquires Level 1 row lock: `SELECT available_seats FROM shared_rides WHERE id = ... FOR UPDATE`. Reads `available_seats = 2`.
     * Acquires Level 2 row lock: `SELECT seats_reserved, status FROM ride_participants WHERE ride_id = ... AND user_id = ... FOR UPDATE`. Reads `status = 'pending'`.
     * Mutates: Sets `status = 'accepted'`; decrements `available_seats = 2 - 1 = 1`.
  2. *Session 2 ($T_2$, Rider Cancel):*
     * Attempts Level 1 row lock: `SELECT ... FROM shared_rides WHERE id = ... FOR UPDATE`.
     * **Contention & Blocking:** Session 2 blocks waiting for Session 1's Level 1 lock. Deadlock is impossible because both functions acquire Level 1 then Level 2.
  3. *Winning Transaction:* Session 1 commits first. Participant is now committed as `'accepted'`; `available_seats` is committed as `1`.
  4. *Session 2 Unblocking & Execution:*
     * Session 2 acquires Level 1 lock, re-reads committed `available_seats = 1`.
     * Session 2 acquires Level 2 lock, reads committed `v_current_status = 'accepted'`.
     * Mutates: Sets `status = 'cancelled'`.
     * Restores Seats: Because `v_current_status = 'accepted'`, evaluates `available_seats = LEAST(4, 1 + 1) = 2`.
     * Session 2 commits.
* **Final State after both transactions commit:**
  * Participant Status: `'cancelled'`.
  * `available_seats`: `2`.
* **Proof of Exactly-Once Restoration:** $T_1$ decremented by 1 (`2 -> 1`); $T_2$ observed `status = 'accepted'` and incremented by 1 (`1 -> 2`). Net change = 0. Repeated invocations of $T_2$ hit the idempotency check `IF v_current_status = 'cancelled'` and return immediately with 0 seats restored.

```sql
-- SESSION 1 (Host Acceptance - Commits First)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SELECT public.accept_ride_participant('ffffffff-ffff-ffff-ffff-ffffffffffff', '22222222-2222-2222-2222-222222222222');

-- SESSION 2 (Rider Cancellation - Attempts Concurrently)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
SELECT public.cancel_ride_reservation('ffffffff-ffff-ffff-ffff-ffffffffffff', '22222222-2222-2222-2222-222222222222');
-- EXPECTED: Session 2 blocks on Level 1 lock (shared_rides FOR UPDATE).

COMMIT; -- in Session 1 (Acceptance commits)
-- Session 2 unblocks, detects committed status = 'accepted', transitions to 'cancelled', restores seat to 2.
COMMIT; -- in Session 2 (Cancellation commits)

-- Verification Query:
-- SELECT available_seats FROM public.shared_rides WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'; -- Returns 2
-- SELECT status FROM public.ride_participants WHERE ride_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff' AND user_id = '22222222-2222-2222-2222-222222222222'; -- Returns 'cancelled'
```

#### TEST-CONC-05B: Cancellation vs. Acceptance Race (Ordering 2: Rider Cancel Commits First)
* **Initial State:** Ride `ffffffff-ffff-ffff-ffff-ffffffffffff` (`total_seats = 4`, `available_seats = 2`). Student B is `status = 'pending'`, `seats_reserved = 1`.
* **Operations & Lock Sequences:**
  1. *Session 2 ($T_2$, Rider Cancel):*
     * Acquires Level 1 row lock: `shared_rides FOR UPDATE`. Reads `available_seats = 2`.
     * Acquires Level 2 row lock: `ride_participants FOR UPDATE`. Reads `status = 'pending'`.
     * Mutates: Sets `status = 'cancelled'`.
     * Seats Evaluation: Because `v_current_status = 'pending'`, zero seats are restored (`available_seats` remains `2`).
  2. *Session 1 ($T_1$, Host Accept):*
     * Attempts Level 1 row lock: `shared_rides FOR UPDATE`.
     * **Contention & Blocking:** Session 1 blocks waiting for Session 2's Level 1 lock.
  3. *Winning Transaction:* Session 2 commits first. Participant status committed as `'cancelled'`; `available_seats` remains `2`.
  4. *Session 1 Unblocking & Execution:*
     * Session 1 acquires Level 1 lock, re-reads `available_seats = 2`.
     * Session 1 acquires Level 2 lock, reads committed `v_current_status = 'cancelled'`.
     * Status Validation: Evaluates `IF v_current_status != 'pending'` (TRUE, status is `'cancelled'`).
     * Abort: Raises custom PL/pgSQL exception **`P0001`**: `RAISE EXCEPTION 'Cannot accept request in status: cancelled (must be pending).'`.
     * Session 1 rolls back completely.
* **Final State after both transactions finish:**
  * Participant Status: `'cancelled'`.
  * `available_seats`: `2`.
* **Proof of Exactly-Once Restoration:** Because the reservation was only pending, no seats were decremented; $T_2$ restored 0 seats; $T_1$ aborted, so 0 seats were decremented. Seat inventory remains strictly intact at 2.

```sql
-- SESSION 2 (Rider Cancellation - Commits First)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
SELECT public.cancel_ride_reservation('ffffffff-ffff-ffff-ffff-ffffffffffff', '22222222-2222-2222-2222-222222222222');

-- SESSION 1 (Host Acceptance - Attempts Concurrently)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SELECT public.accept_ride_participant('ffffffff-ffff-ffff-ffff-ffffffffffff', '22222222-2222-2222-2222-222222222222');
-- EXPECTED: Session 1 blocks on Level 1 lock (shared_rides FOR UPDATE).

COMMIT; -- in Session 2 (Cancellation commits)
-- Session 1 unblocks, re-reads committed status = 'cancelled', raises P0001:
-- ERROR: Cannot accept request in status: cancelled (must be pending).
ROLLBACK; -- in Session 1
```

#### TEST-CONC-06: Host Decline vs. Acceptance Race
* **Setup:** Host clicks Decline in Tab 1 while clicking Accept in Tab 2 for the same applicant.
* **Mechanism:** Both acquire `shared_rides FOR UPDATE` (Level 1). Session 2 blocks on Level 1. Session 1 transitions status to `declined` and commits. Session 2 unblocks, reads `status = 'declined'`, verifies `v_current_status != 'pending'`, and raises custom PL/pgSQL exception **`P0001`**: `Cannot accept request in status: declined (must be pending)`.
```sql
-- SESSION 1 (Host declines)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SELECT public.decline_ride_participant('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222');

-- SESSION 2 (Host accepts in Tab 2)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SELECT public.accept_ride_participant('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222');
-- EXPECTED: Session 2 blocks on Level 1 lock.

COMMIT; -- in Session 1
-- Session 2 unblocks, reads status = 'declined', raises P0001:
-- ERROR: Cannot accept request in status: declined (must be pending).
ROLLBACK; -- in Session 2
```

#### TEST-CONC-07: Cart Closure vs. Concurrent Item Insertion Race
* **Setup:** Cart host locks the cart (`cart_open`) while a student concurrently attempts to insert a grocery item.
* **Exact Transaction Sequence & Mechanism:**
  1. *Session 1 ($T_1$, Cart Host):*
     * Issues `UPDATE group_carts SET status = 'locked' WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'`.
     * PostgreSQL acquires an exclusive **`FOR NO KEY UPDATE`** row lock on the cart tuple.
     * Transaction remains uncommitted.
  2. *Session 2 ($T_2$, Student adding item):*
     * Issues `INSERT INTO cart_items (id, cart_id, added_by_user_id, item_name, quantity) VALUES ('99999999-9999-9999-9999-999999999991', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Fresh Bread', 1)`.
  3. *Trigger Lock Attempt & Blocking Verification:*
     * Database trigger `trg_enforce_cart_item_lock` fires `BEFORE INSERT`.
     * Trigger executes: `SELECT status, lock_at INTO v_cart_status, v_lock_at FROM group_carts WHERE id = NEW.cart_id FOR SHARE`.
     * **Engine Conflict:** Under PostgreSQL's lock compatibility matrix, **`FOR SHARE` strictly conflicts with `FOR NO KEY UPDATE`**.
     * Session 2 is forced into a `lock_wait` state on the tuple lock and blocks while Session 1 is uncommitted.
  4. *Session 1 Commit:*
     * Session 1 commits `status = 'locked'`.
  5. *Recheck After Lock Acquisition:*
     * Session 2 unblocks and acquires its `FOR SHARE` row lock.
     * Under PostgreSQL's `READ COMMITTED` transaction isolation level, `SELECT ... FOR SHARE` re-reads the committed row version.
     * It reads `v_cart_status = 'locked'`.
  6. *Rejection Verification:*
     * Trigger evaluates: `IF v_cart_status != 'open'::group_cart_status OR v_lock_at <= now() THEN RAISE EXCEPTION 'Cart is locked or closed. Items cannot be added, edited, or deleted.'; END IF;`.
     * Exception raised with SQLSTATE **`P0001`**.
     * Session 2's transaction is aborted and rolled back.
  7. *Zero-Item Verification:*
     * Querying `cart_items` confirms `count = 0`. Zero items were inserted into the locked cart.

```sql
-- SESSION 1 (Host locks cart)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
UPDATE public.group_carts 
SET status = 'locked'::group_cart_status 
WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
-- (Session 1 holds FOR NO KEY UPDATE lock on parent cart. Do not commit yet.)

-- SESSION 2 (Student attempts item insertion)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
INSERT INTO public.cart_items (id, cart_id, added_by_user_id, item_name, quantity)
VALUES ('99999999-9999-9999-9999-999999999991', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Fresh Bread', 1);
-- EXPECTED: Trigger trg_enforce_cart_item_lock requests FOR SHARE on parent cart.
-- FOR SHARE conflicts with FOR NO KEY UPDATE. Session 2 BLOCKS on lock_wait.

COMMIT; -- in Session 1 (Cart locked status is committed)

-- EXPECTED RESULT in SESSION 2:
-- Unblocks, re-reads committed status = 'locked', and aborts with:
-- ERROR: Cart is locked or closed. Items cannot be added, edited, or deleted. (SQLSTATE: P0001)
ROLLBACK; -- in Session 2

-- Zero-Item Verification Query (Run as postgres or authenticated):
-- SELECT count(*) FROM public.cart_items WHERE id = '99999999-9999-9999-9999-999999999991';
-- EXPECTED: Returns 0.
```

---

### 9.6 Test Harness Execution & Verification Status

| Category | Count | Status | Operational Notes |
| :--- | :---: | :---: | :--- |
| **1. Tests Documented** | **19** | **DOCUMENTED** | 11 Security Control Tests (`TEST-SEC-01` to `SEC-10B`) + 8 Multi-Session Concurrency Tests (`TEST-CONC-01` to `CONC-07` including `CONC-05A` and `CONC-05B`). |
| **2. Tests Executed** | **0** | **NOT EXECUTED** | Standing operational rule: Zero database migrations executed prior to live Supabase credentials provisioning. |
| **3. Tests Passed** | **0** | **PENDING LIVE EXECUTION** | No test execution claims made based on static documentation review. |
| **4. Tests Failed** | **0** | **PENDING LIVE EXECUTION** | No test failures recorded; execution awaits live PostgreSQL 15 database instance. |
| **5. Tests Not Yet Verified** | **19** | **PENDING INDEPENDENT VERIFICATION** | All documented tests await genuine execution against PostgreSQL 15 in local Docker or Supabase CLI. |

---

## 10. Remaining Risks & Unresolved Operational Decisions

1. **Host Quick-Commerce Abandonment (Operational):**
   * *Scenario:* A cart host locks a cart but loses internet connectivity or battery before ordering on Zepto/Blinkit.
   * *Status in v3.2:* The host or staff can manually set status to `'cancelled'`.
   * *Future Operational Decision:* Schedule a PgCron job to auto-cancel carts idle in `'locked'` state after 2 hours.
2. **Late Ride Cancellations:** Handled peer-to-peer. A future milestone may introduce a reputation cooldown for cancellations within 30 minutes of departure.
3. **Restricted Community Verification:** Tier 2 pickup details are restricted to members. A future enhancement can add access PINs or staff verification for gender-segregated residences (e.g. PDEU Girls Hostel).

---

## 11. Final Architecture Verification Status

> [!IMPORTANT]
> **STATUS: Documented — Not Executed — Pending Independent Verification**  
> Architecture v3.2 specifies mathematical deadlock-freedom, enforces `FOR SHARE` cart locking, isolates column privileges against foreign key drift, uses timezone-safe `now()` comparisons, and establishes an exhaustive SQL security test harness. All database scripts and test scenarios remain unexecuted pending live PostgreSQL 15 Supabase instance provisioning in Phase 2.
