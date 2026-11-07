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

## 9. Comprehensive SQL Security Test Harness (v1.3 Specification)

> **Execution Protocol Notice:**  
> **STATUS: Documented — Not Executed — Pending Independent Verification**  
> This test harness is an executable engineering specification designed for validation against an isolated local Supabase CLI development stack or PostgreSQL 15 test container. In strict compliance with operational boundaries, zero migrations, zero database modifications, and zero tests have been executed on live infrastructure in this phase.
>
> **Execution Separation Notice:**  
> `docs/ARCHITECTURE.md` is a Markdown architectural document and must **not** be executed via `psql -f`. All executable test scripts and schema definitions are prepared as standalone `.sql` files in `supabase/` and `supabase/tests/`.

---

### 9.1 Test File Architecture & Execution Structure

The repository organizes database schema definitions and testing scripts into clean, decoupled files:

| File Path | Execution Role | Purpose |
| :--- | :---: | :--- |
| [`supabase/schema.sql`](file:///Users/savanmalani/Desktop/Savan%20bhaiiii/Yuvnix/supabase/schema.sql) | `postgres` | Complete consolidated DDL: 14 tables, enums, triggers, RPCs, privileges, and RLS policies. |
| [`supabase/tests/fixtures.sql`](file:///Users/savanmalani/Desktop/Savan%20bhaiiii/Yuvnix/supabase/tests/fixtures.sql) | `postgres` | Provisions deterministic test fixtures (profiles, communities, pickup points, carts, rides). |
| [`supabase/tests/security_tests.sql`](file:///Users/savanmalani/Desktop/Savan%20bhaiiii/Yuvnix/supabase/tests/security_tests.sql) | `authenticated` | Automated unit test suite running all 11 security tests (`TEST-SEC-01` to `SEC-10B`). |
| [`supabase/tests/concurrency_session_1.sql`](file:///Users/savanmalani/Desktop/Savan%20bhaiiii/Yuvnix/supabase/tests/concurrency_session_1.sql) | `authenticated` | Terminal 1 interactive commands for multi-session lock contention and race tests. |
| [`supabase/tests/concurrency_session_2.sql`](file:///Users/savanmalani/Desktop/Savan%20bhaiiii/Yuvnix/supabase/tests/concurrency_session_2.sql) | `authenticated` | Terminal 2 interactive commands paired with Session 1 to verify blocking and rollback. |
| [`supabase/tests/cleanup.sql`](file:///Users/savanmalani/Desktop/Savan%20bhaiiii/Yuvnix/supabase/tests/cleanup.sql) | `postgres` | Deterministic teardown script purging all test fixtures in reverse foreign key order. |

---

### 9.2 Recommended Local Test Environment (Supabase CLI Primary Stack)

Testing Row Level Security and PostgreSQL privileges requires an environment identical to Supabase Cloud, without needing production credentials or risking project state.

#### 1. Primary Recommendation: Local Supabase CLI Development Stack
The Supabase CLI provisions a complete, isolated local environment powered by Docker containing PostgreSQL 15, GoTrue (Auth), PostgREST, and Storage.

```bash
# Step 1: Initialize local Supabase project (if not already initialized)
supabase init

# Step 2: Start the local disposable Supabase stack
supabase start
# Output displays local endpoints:
#   DB URL: postgresql://postgres:postgres@localhost:54322/postgres
#   Studio: http://localhost:54323
#   API:    http://localhost:54321

# Step 3: Apply the consolidated Yuvnix schema to the local database
psql -h localhost -p 54322 -U postgres -d postgres -f supabase/schema.sql

# Step 4: Provision deterministic test fixtures
psql -h localhost -p 54322 -U postgres -d postgres -f supabase/tests/fixtures.sql

# Step 5: Execute automated security control tests
psql -h localhost -p 54322 -U postgres -d postgres -f supabase/tests/security_tests.sql

# Step 6: Execute multi-session concurrency tests
# Open Terminal 1: psql -h localhost -p 54322 -U postgres -d postgres
# Open Terminal 2: psql -h localhost -p 54322 -U postgres -d postgres
# Follow step-by-step instructions in supabase/tests/concurrency_session_1.sql & session_2.sql

# Step 7: Teardown test fixtures
psql -h localhost -p 54322 -U postgres -d postgres -f supabase/tests/cleanup.sql

# Step 8: Reset and stop the local environment
supabase stop --no-backup
```

#### 2. Standalone PostgreSQL Docker Limitations & Mock Requirements
While a vanilla `postgres:15` Docker container can run basic SQL syntax, **a minimal `auth.uid()` mock is not sufficient to claim full Supabase RLS compatibility**. 

Running in vanilla PostgreSQL lacks the following critical Supabase production components:
1. **The `auth` Schema & Identity Lifecycle:** In Supabase, user creation, metadata parsing, and token generation trigger internal hooks. A simple mock omits `auth.jwt()`, `auth.role()`, email confirmation flags, and JWT claim refresh mechanics.
2. **PostgREST Role Switching Architecture:** In production Supabase, incoming HTTP requests arrive under the proxy role `authenticator`, which reads the bearer token and executes `SET LOCAL ROLE authenticated` or `SET LOCAL ROLE anon`. Testing in standalone Postgres without this role-switching layer fails to catch role-leakage or privilege-escalation bugs across connection pools.
3. **Supabase System Roles:** Supabase relies on built-in engine roles (`anon`, `authenticated`, `service_role`, `supabase_admin`, `supabase_auth_admin`). In vanilla Postgres, all these roles must be manually mocked with precise `NOINHERIT` and `GRANT` permissions.
4. **Realtime CDC Infrastructure:** Supabase Realtime uses `supabase_realtime` logical publication for WebSocket event streaming. Testing cart and ride chat subscriptions requires this publication.
5. **PostgreSQL Extensions:** Extensions pre-bundled in Supabase (`uuid-ossp`, `pgcrypto`, `pgjwt`, `pg_stat_statements`) must be compiled into the container.

*Conclusion:* **The local Supabase CLI (`supabase start`) is the only authoritative, realistic testing target.** Vanilla PostgreSQL containers should only be used as a syntax validation fallback.

---

### 9.3 Authentication Context & Role Simulation Protocol

To simulate authenticated students and support staff during testing:

1. **Role Context:** Every test transaction executes `SET LOCAL ROLE authenticated;`, discarding superuser privileges for the transaction.
2. **JWT Claims Injection:** PostgREST passes JWT claims through PostgreSQL session settings. Tests inject these claims via `request.jwt.claim.sub` and `request.jwt.claims`.
3. **Session Verification:** Tests verify `auth.uid()` derivation immediately after configuration. If `auth.uid()` does not match the target fixture UUID, the test aborts.
4. **Support Staff Simulation:** In Yuvnix, support staff are not a separate PostgreSQL role; they connect as `authenticated` with `public.profiles.role = 'support_staff'`. Functions such as `public.is_staff_or_admin()` query `public.profiles` for `auth.uid()` to verify administrative authority.
5. **Automatic Teardown:** Every test runs inside an isolated `BEGIN ... ROLLBACK;` transaction block, ensuring zero persistent mutations during test evaluation.

---

### 9.4 Comprehensive Security Control Test Suite (TEST-SEC-01 to SEC-10B)

Refer to [`supabase/tests/security_tests.sql`](file:///Users/savanmalani/Desktop/Savan%20bhaiiii/Yuvnix/supabase/tests/security_tests.sql) for the complete executable SQL.

| Test ID | Control & Attack Scenario | Exact Database Operation | Expected Enforcement Layer | Expected SQLSTATE / Result |
| :--- | :--- | :--- | :--- | :---: |
| **`TEST-SEC-01`** | Student role escalation attempt | `UPDATE profiles SET role = 'support_staff'` | Column privilege check (`trg_prevent_role_escalation` defense) | **`42501`** (or `P0001`) |
| **`TEST-SEC-02`** | Pickup-point privacy (Positive & Negative) | `SELECT delivery_pickup_point FROM community_pickup_points` | RLS policy `pickup_points_select_members_only` | Active: **1 exact row**<br>Non-member: **0 rows** |
| **`TEST-SEC-03`** | Cart chat access isolation | `INSERT INTO cart_messages ...` by non-participant | RLS policy `cart_messages_insert_members_only` `WITH CHECK` | **`42501`** (`insufficient_privilege`) |
| **`TEST-SEC-04`** | Ride chat access isolation | `SELECT` and `INSERT` on `ride_messages` by pending rider | RLS policies `ride_messages_select/insert_accepted_only` | Read: **0 rows**<br>Write: **`42501`** |
| **`TEST-SEC-05`** | Direct participant mutations | Direct `INSERT`, `UPDATE`, `DELETE` on `ride_participants` | Table privilege revocation (RPCs only) | **`42501`** for all 3 operations |
| **`TEST-SEC-06`** | Cart item `cart_id` tampering | `UPDATE cart_items SET cart_id = ...` | Column privilege check on `cart_id` | **`42501`** |
| **`TEST-SEC-07`** | Cart item owner tampering | `UPDATE cart_items SET added_by_user_id = ...` | Column privilege check on `added_by_user_id` | **`42501`** |
| **`TEST-SEC-08`** | Direct notification forgery | Direct `INSERT INTO notifications ...` | Table privilege revocation on `notifications` | **`42501`** |
| **`TEST-SEC-09`** | Notification title tampering | `UPDATE notifications SET title = ...` | Column privilege check on `title` (`is_read` only) | **`42501`** |
| **`TEST-SEC-10A`**| Community creation governance | Student direct insert vs. Staff authorized insert | Table privilege check & RLS `communities_staff_all` | Student: **`42501`**<br>Staff: **Success** |
| **`TEST-SEC-10B`**| Community approval governance | Student self-approval vs. Staff authorized approval | RLS policy `community_requests_update_staff_only` | Student: **0 rows updated**<br>Staff: **Status = 'approved'** |

---

### 9.5 Verified Multi-Session Concurrency Test Suite (CONC-01 to CONC-07)

Refer to [`supabase/tests/concurrency_session_1.sql`](file:///Users/savanmalani/Desktop/Savan%20bhaiiii/Yuvnix/supabase/tests/concurrency_session_1.sql) and [`supabase/tests/concurrency_session_2.sql`](file:///Users/savanmalani/Desktop/Savan%20bhaiiii/Yuvnix/supabase/tests/concurrency_session_2.sql) for the exact session-by-session commands.

#### Analysis of Concurrency Mechanisms & Engine Invariants

##### 1. Unique Index Constraint vs. Concurrent Users (`TEST-CONC-01` & `TEST-CONC-02`)
* In PostgreSQL, `UNIQUE (ride_id, user_id)` creates a b-tree index over `(ride_id, user_id)`.
* When two **different** users ($R_1, R_2$) call `request_ride_seats()`, their index keys `(ride_1, R_1)` and `(ride_1, R_2)` are distinct. Neither blocks the other; both acquire Level 1 `FOR SHARE` locks (which are mutually compatible) and register as `pending`.
* When the **same** user ($R_1$) submits rapid concurrent requests, both transactions attempt to insert the identical key `(ride_1, R_1)`. Session 2 blocks on the tuple lock of the unique index held by Session 1. When Session 1 commits, Session 2 unblocks, fails the `WHERE status IN ('declined', 'cancelled')` condition, updates 0 rows, and raises custom PL/pgSQL exception **`P0001`**: `'A pending seat request is already active for this ride.'`.

##### 2. Lock Ordering & Deadlock Prevention (`TEST-CONC-03` to `TEST-CONC-06`)
* Deadlocks occur when two transactions acquire locks in opposing orders ($T_1: L_1 ightarrow L_2$ vs $T_2: L_2 ightarrow L_1$).
* All ride lifecycle RPCs enforce strict linear parent-to-child lock acquisition:  
  $$	ext{Level 1: } 	exttt{public.shared_rides} \prec 	ext{Level 2: } 	exttt{public.ride_participants}$$
* In `accept_ride_participant()`:
  * Line 613: `SELECT available_seats FROM public.shared_rides WHERE id = p_ride_id FOR UPDATE;` (Level 1)
  * Line 625: `SELECT seats_reserved, status FROM public.ride_participants WHERE ride_id = p_ride_id AND user_id = p_applicant_user_id FOR UPDATE;` (Level 2)
* In `cancel_ride_reservation()`:
  * Line 781: `SELECT (created_by_user_id = v_caller_id), total_seats, available_seats FROM public.shared_rides WHERE id = p_ride_id FOR UPDATE;` (Level 1)
  * Line 798: `SELECT seats_reserved, status FROM public.ride_participants WHERE ride_id = p_ride_id AND user_id = p_participant_user_id FOR UPDATE;` (Level 2)
* In `decline_ride_participant()`:
  * Line 697: `PERFORM 1 FROM public.shared_rides WHERE id = p_ride_id FOR UPDATE;` (Level 1)
  * Line 709: `SELECT status FROM public.ride_participants WHERE ride_id = p_ride_id AND user_id = p_applicant_user_id FOR UPDATE;` (Level 2)
* Because all routines acquire Level 1 first, lock contention resolves immediately on the parent `shared_rides` tuple. Circular lock waits are mathematically impossible.

##### 3. Verification of Cancellation vs. Acceptance Logic (`TEST-CONC-05A` & `TEST-CONC-05B`)
* **Acceptance Decrements Seats Exactly Once:**  
  In `accept_ride_participant()`, lines 648-654:
  ```sql
  UPDATE public.ride_participants SET status = 'accepted' WHERE ride_id = p_ride_id AND user_id = p_applicant_user_id;
  UPDATE public.shared_rides SET available_seats = available_seats - v_seats_requested WHERE id = p_ride_id;
  ```
  Guarded by line 642: `IF v_current_status != 'pending' THEN RAISE EXCEPTION ...`. If the participant is already accepted, lines 638-640 return immediately without modifying `available_seats`.
* **Cancellation Restores Seats ONLY When Previous Status was `'accepted'`:**  
  In `cancel_ride_reservation()`, lines 814-820:
  ```sql
  IF v_current_status = 'accepted'::ride_participant_status THEN
      UPDATE public.shared_rides
      SET available_seats = LEAST(total_seats, available_seats + v_seats_to_release),
          status = 'open'::shared_ride_status,
          updated_at = now()
      WHERE id = p_ride_id;
  END IF;
  ```
  If `v_current_status = 'pending'`, the `IF` condition evaluates to `FALSE`; `shared_rides` is not touched, and 0 seats are restored.
* **Repeated Cancellation Cannot Restore Seats Twice:**  
  In `cancel_ride_reservation()`, lines 807-809:
  ```sql
  IF v_current_status = 'cancelled'::ride_participant_status THEN
      RETURN jsonb_build_object('success', true, 'message', 'Reservation already cancelled.');
  END IF;
  ```
  The first cancellation transitions `status = 'cancelled'`. Any subsequent invocation hits lines 807-809 and exits immediately with `seats_released = 0`.
* **Ordering Outcomes:**
  * *Ordering 1 (`TEST-CONC-05A`, Host Accept commits first):* Host decrements seats `2 -> 1`. Rider cancel unblocks, sees `status = 'accepted'`, transitions to `'cancelled'`, restores seat `1 -> 2`. Final: `status = 'cancelled'`, `available_seats = 2`.
  * *Ordering 2 (`TEST-CONC-05B`, Rider Cancel commits first):* Rider transitions `'pending' -> 'cancelled'`, restores 0 seats (`available_seats = 2`). Host accept unblocks, sees `status = 'cancelled' != 'pending'`, aborts with SQLSTATE **`P0001`**, and rolls back. Final: `status = 'cancelled'`, `available_seats = 2`.
  * *Invariance:* In both orderings, seat counts and participant states are deterministic and consistent.

##### 4. Verification of Cart Lock Concurrency (`TEST-CONC-07`)
* In `enforce_cart_item_lock()`, lines 463-466:
  ```sql
  SELECT status, lock_at INTO v_cart_status, v_lock_at FROM public.group_carts WHERE id = v_cart_id FOR SHARE;
  ```
* When cart host issues `UPDATE group_carts SET status = 'locked'`, PostgreSQL acquires `FOR NO KEY UPDATE` lock on the cart tuple.
* In-flight student insert fires `BEFORE INSERT` trigger requesting `FOR SHARE`.
* Under PostgreSQL's lock compatibility matrix, **`FOR SHARE` conflicts with `FOR NO KEY UPDATE`**.
* The student transaction blocks. When the host commits, the trigger acquires `FOR SHARE`, re-reads committed `status = 'locked'`, evaluates `IF v_cart_status != 'open'::group_cart_status`, and raises custom PL/pgSQL exception **`P0001`**: `'Cart is locked or closed. Items cannot be added, edited, or deleted.'`. Zero items are inserted.

---

### 9.6 Test Harness Execution & Verification Status

| Category | Count | Status | Operational Notes |
| :--- | :---: | :---: | :--- |
| **1. Tests Documented** | **19** | **DOCUMENTED** | 11 Security Control Tests (`TEST-SEC-01` to `SEC-10B`) + 8 Multi-Session Concurrency Tests (`TEST-CONC-01` to `CONC-07`). Fully specified. |
| **2. Standalone SQL Scripts**| **6** | **PREPARED** | `supabase/schema.sql`, `fixtures.sql`, `security_tests.sql`, `concurrency_session_1.sql`, `concurrency_session_2.sql`, `cleanup.sql`. |
| **3. Tests Executed** | **0** | **NOT EXECUTED** | Standing operational rule enforced: Zero database migrations executed prior to live Supabase credentials provisioning. |
| **4. Tests Passed** | **0** | **PENDING LIVE EXECUTION** | No test execution or pass claims are made based on static documentation review. |
| **5. Tests Failed** | **0** | **PENDING LIVE EXECUTION** | No test failures recorded; execution awaits local Supabase CLI provisioning. |
| **6. Tests Not Yet Verified**| **19** | **PENDING INDEPENDENT VERIFICATION** | All documented tests await execution against local PostgreSQL 15 in Phase 2. |

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
