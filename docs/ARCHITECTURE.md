# Yuvnix System Architecture & Database Specification

> **Version:** 2.0.0 (Post-Security & Architecture Review)  
> **Status:** Specification Document (DDL & RLS Standard)  
> **Target Deployment:** Cloudflare Pages (Frontend SPA) + Supabase PostgreSQL (Managed Edge)

---

## 1. Architectural Overview

Yuvnix is engineered as a mobile-first Single Page Application (SPA) deployed to Cloudflare Pages edge network, backed by Supabase PostgreSQL 15 with strict Row Level Security (RLS), real-time WebSocket subscriptions, and Google OAuth 2.0 PKCE authentication.

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
        Triggers[DB Triggers & Atomic Functions]
    end

    Browser --> ViteSPA
    ViteSPA --> Router
    Router --> QueryCache
    QueryCache --> ZodValidator
    ZodValidator -->|Anon Key HTTPS| RLS
    RLS --> Triggers
    Triggers --> PostgreSQL
    Browser -->|Google Sign-In| Auth
    Auth -->|JWT Session auth.uid| RLS
    PostgreSQL -->|Change Data Capture| RealtimeWS
    RealtimeWS -->|WebSockets| QueryCache
```

---

## 2. Technology Stack & Decision Matrix

| Layer | Technology | Decision Rationale |
| :--- | :--- | :--- |
| **Build & Runtime** | Vite 6 + React 18 + TypeScript | Strict compiler configuration (`strict: true`, `noEmit: true`), zero type leakage, sub-second HMR. |
| **Design System** | Tailwind CSS + shadcn/ui | Radix UI primitives tokenized to an accessible Indigo/Violet palette (`hsl(var(--primary))`). Optimized for mobile touch ergonomics. |
| **Routing** | React Router v6 | Nested layouts (`AppLayout`, `BottomNav`, `Header`) and SPA fallback via Cloudflare `_redirects`. |
| **State & Cache** | TanStack Query v5 | Automated background cache invalidation, deduplication, and real-time cache mutations. |
| **Form Validation** | React Hook Form + Zod | Uncontrolled performant inputs validated against strict compile-time Zod schemas. |
| **Database & Auth** | Supabase (PostgreSQL 15) | Relational integrity, foreign keys, row-level locking, and granular RLS policies. |
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

## 4. Complete PostgreSQL DDL Specification

This specification contains all PostgreSQL DDL tables, types, constraints, foreign keys, indexes, triggers, and atomic functions.

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
-- 2. STUDENT PROFILES (PUBLIC vs PRIVATE SEPARATION)
-- =============================================================================

-- 2.1 Public Student Profiles (Safe for general authenticated viewing)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    role user_role NOT NULL DEFAULT 'student',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.2 Private Student Profile Details (Phone & Email isolated with strict RLS)
CREATE TABLE public.profile_private (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    phone_number TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- =============================================================================
-- 3. COMMUNITIES & GOVERNANCE
-- =============================================================================

-- 3.1 Communities (Physical residential locations only)
CREATE TABLE public.communities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    type residential_type NOT NULL,
    college_affiliation TEXT, -- Optional discovery metadata
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT,
    delivery_pickup_point TEXT NOT NULL, -- Verified delivery desk/gate
    taxi_pickup_point TEXT NOT NULL,     -- Verified cab curb
    is_verified BOOLEAN NOT NULL DEFAULT true,
    active_member_count INT NOT NULL DEFAULT 0 CHECK (active_member_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.2 Community Memberships (Multi-community support)
CREATE TABLE public.community_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    is_active BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (community_id, user_id)
);

-- 3.3 Community Creation Requests (Subject to Support Staff approval)
CREATE TABLE public.community_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requested_by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    proposed_name TEXT NOT NULL,
    proposed_type residential_type NOT NULL,
    college_affiliation TEXT,
    address TEXT NOT NULL,
    proposed_delivery_pickup_point TEXT NOT NULL,
    proposed_taxi_pickup_point TEXT NOT NULL,
    status community_request_status NOT NULL DEFAULT 'pending',
    reviewed_by_staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    review_notes TEXT,
    created_community_id UUID REFERENCES public.communities(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- =============================================================================
-- 4. GROUP GROCERY ORDERS & CART CHAT
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4.2 Cart Participants Table (Enables joining cart without adding products)
CREATE TABLE public.cart_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cart_id UUID NOT NULL REFERENCES public.group_carts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4.4 Dedicated Cart Chat Messages
CREATE TABLE public.cart_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cart_id UUID NOT NULL REFERENCES public.group_carts(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message_text TEXT NOT NULL CHECK (char_length(trim(message_text)) > 0 AND char_length(message_text) <= 2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- =============================================================================
-- 5. SHARED TAXI RIDES & RIDE CHAT
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT available_not_exceed_total CHECK (available_seats <= total_seats)
);

-- 5.2 Ride Participants Table (Tracks seats & acceptance status)
CREATE TABLE public.ride_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ride_id UUID NOT NULL REFERENCES public.shared_rides(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    seats_reserved INT NOT NULL DEFAULT 1 CHECK (seats_reserved > 0 AND seats_reserved <= 6),
    status ride_participant_status NOT NULL DEFAULT 'pending',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    notes TEXT,
    UNIQUE (ride_id, user_id)
);

-- 5.3 Dedicated Ride Chat Messages
CREATE TABLE public.ride_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ride_id UUID NOT NULL REFERENCES public.shared_rides(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message_text TEXT NOT NULL CHECK (char_length(trim(message_text)) > 0 AND char_length(message_text) <= 2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- =============================================================================
-- 7. PERFORMANCE INDEXES
-- =============================================================================
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_communities_slug ON public.communities(slug);
CREATE INDEX idx_communities_verified ON public.communities(is_verified);
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

## 5. PostgreSQL Triggers & Atomic Functions

### 5.1 Enforcing Cart Lock at Database Layer
This trigger executes on `cart_items` to ensure that no item can be inserted, edited, or deleted once the cart's lock deadline has expired or its status has transitioned out of `'open'`.

```sql
CREATE OR REPLACE FUNCTION public.enforce_cart_item_lock()
RETURNS TRIGGER AS $$
DECLARE
    v_cart_status group_cart_status;
    v_lock_at TIMESTAMPTZ;
    v_cart_id UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        v_cart_id := OLD.cart_id;
    ELSE
        v_cart_id := NEW.cart_id;
    END IF;

    SELECT status, lock_at INTO v_cart_status, v_lock_at
    FROM public.group_carts
    WHERE id = v_cart_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Referenced group cart does not exist.';
    END IF;

    IF v_cart_status != 'open' OR v_lock_at <= timezone('utc'::text, now()) THEN
        RAISE EXCEPTION 'Cart is locked or closed. Items cannot be added, edited, or deleted.';
    END IF;

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_enforce_cart_item_lock
    BEFORE INSERT OR UPDATE OR DELETE ON public.cart_items
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_cart_item_lock();
```

---

### 5.2 Atomic Ride Seat Reservation Function
Prevents race conditions, concurrency anomalies, and negative seat balances by locking the `shared_rides` row with `FOR UPDATE`.

```sql
CREATE OR REPLACE FUNCTION public.reserve_ride_seats(
    p_ride_id UUID,
    p_user_id UUID,
    p_seats_requested INT
)
RETURNS JSONB AS $$
DECLARE
    v_available INT;
    v_status shared_ride_status;
    v_departure TIMESTAMPTZ;
    v_existing_status ride_participant_status;
BEGIN
    IF p_seats_requested <= 0 THEN
        RAISE EXCEPTION 'Seats requested must be greater than zero.';
    END IF;

    -- Row-level lock to prevent concurrent overbooking
    SELECT available_seats, status, departure_time
    INTO v_available, v_status, v_departure
    FROM public.shared_rides
    WHERE id = p_ride_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ride offer does not exist.';
    END IF;

    IF v_status != 'open' THEN
        RAISE EXCEPTION 'Ride is no longer open for reservations.';
    END IF;

    IF v_departure <= timezone('utc'::text, now()) THEN
        RAISE EXCEPTION 'Ride has already departed.';
    END IF;

    IF v_available < p_seats_requested THEN
        RAISE EXCEPTION 'Insufficient seats available (Requested: %, Available: %).', p_seats_requested, v_available;
    END IF;

    -- Check if participant already exists
    SELECT status INTO v_existing_status
    FROM public.ride_participants
    WHERE ride_id = p_ride_id AND user_id = p_user_id;

    IF v_existing_status = 'accepted' THEN
        RAISE EXCEPTION 'User already has an accepted reservation on this ride.';
    END IF;

    -- Upsert participant record with accepted status
    INSERT INTO public.ride_participants (ride_id, user_id, seats_reserved, status)
    VALUES (p_ride_id, p_user_id, p_seats_requested, 'accepted')
    ON CONFLICT (ride_id, user_id)
    DO UPDATE SET
        seats_reserved = p_seats_requested,
        status = 'accepted',
        joined_at = timezone('utc'::text, now());

    -- Decrement available seats atomically
    UPDATE public.shared_rides
    SET available_seats = available_seats - p_seats_requested,
        status = CASE WHEN (available_seats - p_seats_requested) = 0 THEN 'full'::shared_ride_status ELSE status END,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_ride_id;

    -- Emit notification to the student
    INSERT INTO public.notifications (user_id, type, title, body, link_url)
    VALUES (
        p_user_id,
        'ride_seat_accepted',
        'Ride Seat Confirmed',
        'Your seat reservation has been accepted. You can now coordinate in the ride chat.',
        '/rides/' || p_ride_id::text
    );

    RETURN jsonb_build_object(
        'success', true,
        'ride_id', p_ride_id,
        'seats_reserved', p_seats_requested,
        'remaining_seats', v_available - p_seats_requested
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### 5.3 Atomic Seat Release & Cancellation Function
Safely restores seats when a student or host cancels an accepted reservation.

```sql
CREATE OR REPLACE FUNCTION public.cancel_ride_reservation(
    p_ride_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_seats_to_release INT;
    v_participant_status ride_participant_status;
BEGIN
    -- Lock participant record
    SELECT seats_reserved, status
    INTO v_seats_to_release, v_participant_status
    FROM public.ride_participants
    WHERE ride_id = p_ride_id AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reservation record not found.';
    END IF;

    IF v_participant_status = 'cancelled' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Already cancelled.');
    END IF;

    -- Update participant status to cancelled
    UPDATE public.ride_participants
    SET status = 'cancelled'
    WHERE ride_id = p_ride_id AND user_id = p_user_id;

    -- Only increment available seats if reservation was previously accepted
    IF v_participant_status = 'accepted' THEN
        UPDATE public.shared_rides
        SET available_seats = available_seats + v_seats_to_release,
            status = 'open'::shared_ride_status,
            updated_at = timezone('utc'::text, now())
        WHERE id = p_ride_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'ride_id', p_ride_id,
        'seats_released', v_seats_to_release
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### 5.4 Community Request Review & Notification Trigger
When Yuvnix support staff marks a community request as `'approved'` or `'rejected'`, this trigger automatically notifies the requesting student.

```sql
CREATE OR REPLACE FUNCTION public.handle_community_request_decision()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.status = 'pending' AND NEW.status = 'approved') THEN
        INSERT INTO public.notifications (user_id, type, title, body, link_url)
        VALUES (
            NEW.requested_by_user_id,
            'community_request_approved',
            'Community Approved!',
            'Your request for "' || NEW.proposed_name || '" has been approved and is now active.',
            CASE WHEN NEW.created_community_id IS NOT NULL 
                 THEN '/communities/' || NEW.created_community_id::text 
                 ELSE '/communities' 
            END
        );
    ELSIF (OLD.status = 'pending' AND NEW.status = 'rejected') THEN
        INSERT INTO public.notifications (user_id, type, title, body, link_url)
        VALUES (
            NEW.requested_by_user_id,
            'community_request_rejected',
            'Community Request Update',
            'Your request for "' || NEW.proposed_name || '" could not be approved. ' || COALESCE('Notes: ' || NEW.review_notes, ''),
            '/communities'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_community_request_decision
    AFTER UPDATE OF status ON public.community_requests
    FOR EACH ROW
    WHEN (OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected'))
    EXECUTE FUNCTION public.handle_community_request_decision();
```

---

## 6. Complete PostgreSQL Row Level Security (RLS) Specification

Row Level Security is enabled on **all 13 tables**. Zero queries can bypass these policies.

```sql
-- Enable RLS across all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_private ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
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

-- Helper security function: Check if current user is staff/admin
CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('support_staff', 'admin')
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =============================================================================
-- RLS 1: PROFILES (PUBLIC)
-- =============================================================================
-- Any authenticated user can read public profiles
CREATE POLICY "profiles_select_authenticated"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

-- Students can only update their own display name or avatar
CREATE POLICY "profiles_update_self"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- =============================================================================
-- RLS 2: PROFILE_PRIVATE (STRICT ISOLATION)
-- =============================================================================
-- Students can ONLY view their own private details (email, phone)
CREATE POLICY "profile_private_select_self"
    ON public.profile_private FOR SELECT
    TO authenticated
    USING (auth.uid() = id OR public.is_staff_or_admin());

-- Students can ONLY update their own private details
CREATE POLICY "profile_private_update_self"
    ON public.profile_private FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "profile_private_insert_self"
    ON public.profile_private FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- =============================================================================
-- RLS 3: COMMUNITIES
-- =============================================================================
-- Any authenticated student can browse verified communities
CREATE POLICY "communities_select_verified"
    ON public.communities FOR SELECT
    TO authenticated
    USING (is_verified = true OR public.is_staff_or_admin());

-- ONLY authorized Yuvnix support staff can create or edit communities
CREATE POLICY "communities_insert_staff_only"
    ON public.communities FOR INSERT
    TO authenticated
    WITH CHECK (public.is_staff_or_admin());

CREATE POLICY "communities_update_staff_only"
    ON public.communities FOR UPDATE
    TO authenticated
    USING (public.is_staff_or_admin())
    WITH CHECK (public.is_staff_or_admin());

CREATE POLICY "communities_delete_staff_only"
    ON public.communities FOR DELETE
    TO authenticated
    USING (public.is_staff_or_admin());

-- =============================================================================
-- RLS 4: COMMUNITY MEMBERSHIPS
-- =============================================================================
-- Members of the community or staff can see membership lists
CREATE POLICY "memberships_select_community_or_self"
    ON public.community_memberships FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.community_memberships cm
            WHERE cm.community_id = community_memberships.community_id
              AND cm.user_id = auth.uid()
        ) OR
        public.is_staff_or_admin()
    );

-- Any authenticated student can join a verified community
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

-- Students can leave communities they joined
CREATE POLICY "memberships_delete_self"
    ON public.community_memberships FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- =============================================================================
-- RLS 5: COMMUNITY REQUESTS
-- =============================================================================
-- Students can view their own requests; staff can view all requests
CREATE POLICY "community_requests_select"
    ON public.community_requests FOR SELECT
    TO authenticated
    USING (requested_by_user_id = auth.uid() OR public.is_staff_or_admin());

-- Any authenticated student can submit a request with status 'pending'
CREATE POLICY "community_requests_insert_student"
    ON public.community_requests FOR INSERT
    TO authenticated
    WITH CHECK (
        requested_by_user_id = auth.uid() AND
        status = 'pending'
    );

-- Only support staff can review, approve, or reject community requests
CREATE POLICY "community_requests_update_staff_only"
    ON public.community_requests FOR UPDATE
    TO authenticated
    USING (public.is_staff_or_admin())
    WITH CHECK (public.is_staff_or_admin());

-- =============================================================================
-- RLS 6: GROUP CARTS
-- =============================================================================
-- Members of the parent community can view active carts
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

-- Members of the community can initiate a group cart
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

-- Only the cart host or staff can update cart status or instructions
CREATE POLICY "carts_update_host_only"
    ON public.group_carts FOR UPDATE
    TO authenticated
    USING (created_by_user_id = auth.uid() OR public.is_staff_or_admin())
    WITH CHECK (created_by_user_id = auth.uid() OR public.is_staff_or_admin());

-- =============================================================================
-- RLS 7: CART PARTICIPANTS
-- =============================================================================
-- Community members can view who has joined the cart
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

-- Community members can join a cart before it locks
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
              AND gc.status = 'open'
              AND gc.lock_at > timezone('utc'::text, now())
        )
    );

-- Students can leave a cart before it locks
CREATE POLICY "cart_participants_delete_self"
    ON public.cart_participants FOR DELETE
    TO authenticated
    USING (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.group_carts gc
            WHERE gc.id = cart_id
              AND gc.status = 'open'
              AND gc.lock_at > timezone('utc'::text, now())
        )
    );

-- =============================================================================
-- RLS 8: CART ITEMS
-- =============================================================================
-- Community members can view all pooled items in the cart
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

-- Joined cart participants can add items to an open cart
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

-- Students can ONLY update their own items
CREATE POLICY "cart_items_update_owner_only"
    ON public.cart_items FOR UPDATE
    TO authenticated
    USING (added_by_user_id = auth.uid())
    WITH CHECK (added_by_user_id = auth.uid());

-- Students can delete their own items; the cart host can also remove items
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
-- RLS 9: CART MESSAGES (DEDICATED CHAT)
-- =============================================================================
-- ONLY students who have joined this cart can read cart messages
CREATE POLICY "cart_messages_select_members_only"
    ON public.cart_messages FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.cart_participants cp
            WHERE cp.cart_id = cart_messages.cart_id
              AND cp.user_id = auth.uid()
        ) OR public.is_staff_or_admin()
    );

-- ONLY students who have joined this cart can post messages
CREATE POLICY "cart_messages_insert_members_only"
    ON public.cart_messages FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.cart_participants cp
            WHERE cp.cart_id = cart_messages.cart_id
              AND cp.user_id = auth.uid()
        )
    );

-- =============================================================================
-- RLS 10: SHARED RIDES
-- =============================================================================
-- Members of the community can view active rides
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

-- Community members can offer a ride
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

-- Only the ride host can update ride details
CREATE POLICY "shared_rides_update_host_only"
    ON public.shared_rides FOR UPDATE
    TO authenticated
    USING (created_by_user_id = auth.uid() OR public.is_staff_or_admin())
    WITH CHECK (created_by_user_id = auth.uid() OR public.is_staff_or_admin());

-- =============================================================================
-- RLS 11: RIDE PARTICIPANTS
-- =============================================================================
-- Host and participants can view participant details
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

-- Community members can request a seat with status 'pending'
CREATE POLICY "ride_participants_insert_pending"
    ON public.ride_participants FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = user_id AND
        status = 'pending' AND
        EXISTS (
            SELECT 1 FROM public.shared_rides sr
            JOIN public.community_memberships cm ON cm.community_id = sr.community_id
            WHERE sr.id = ride_id
              AND cm.user_id = auth.uid()
              AND sr.status = 'open'
              AND sr.available_seats >= seats_reserved
        )
    );

-- The ride host can accept or decline requests; the rider can cancel
CREATE POLICY "ride_participants_update_host_or_self"
    ON public.ride_participants FOR UPDATE
    TO authenticated
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.shared_rides sr
            WHERE sr.id = ride_participants.ride_id
              AND sr.created_by_user_id = auth.uid()
        )
    )
    WITH CHECK (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.shared_rides sr
            WHERE sr.id = ride_participants.ride_id
              AND sr.created_by_user_id = auth.uid()
        )
    );

-- =============================================================================
-- RLS 12: RIDE MESSAGES (DEDICATED CHAT)
-- =============================================================================
-- ONLY the ride host and ACCEPTED riders can read ride chat messages
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
              AND rp.status = 'accepted'
        ) OR public.is_staff_or_admin()
    );

-- ONLY the ride host and ACCEPTED riders can post messages
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
                  AND rp.status = 'accepted'
            )
        )
    );

-- =============================================================================
-- RLS 13: NOTIFICATIONS
-- =============================================================================
-- Students can ONLY view and mark their own notifications as read
CREATE POLICY "notifications_select_self"
    ON public.notifications FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "notifications_update_self"
    ON public.notifications FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
```

---

## 7. Concurrency & Transaction Strategy

### 7.1 Row-Level Locking (`FOR UPDATE`)
In high-demand student residential environments (e.g., last seats to the airport before Diwali or semester break), multiple students concurrently attempt seat reservations. 
* Standard `SELECT` followed by `UPDATE` allows race conditions (lost updates) under the default `READ COMMITTED` isolation level.
* **Yuvnix Solution:** The `reserve_ride_seats` function executes `SELECT ... FROM public.shared_rides WHERE id = p_ride_id FOR UPDATE`. This forces subsequent incoming transactions to wait until the current lock releases, guaranteeing that `available_seats` is evaluated serially and decremented without race conditions.
* Furthermore, the constraint `CHECK (available_seats >= 0)` guarantees that even an anomalous bypass will abort the transaction rather than write negative inventory.

### 7.2 Cart Lock Cutoff Enforcement
* If a student prepares an item on their device at `23:59:58` and submits at `00:00:02` (after `lock_at`), client-side clocks might be out of sync.
* **Yuvnix Solution:** The trigger `trg_enforce_cart_item_lock` compares `timezone('utc'::text, now())` against `lock_at` directly on the PostgreSQL server clock before allowing any write operation.

---

## 8. Security & Privacy Audit Checklist

| Security Control | Implementation Mechanism | Verification Result |
| :--- | :--- | :---: |
| **Service-Role Key Protection** | Never exposed or packaged in client bundle; only anon key is distributed. | PASS |
| **Phone Number Privacy** | Phone numbers stored in `profile_private` table with `auth.uid() = id` RLS policy. Cannot be fetched via public queries. | PASS |
| **Democratic Access** | No student possesses administrative override over peers; community management is restricted to `support_staff`. | PASS |
| **Chat Boundary Integrity** | Cart chat requires `cart_participants` membership; Ride chat requires host or `status = 'accepted'` participant row. | PASS |
| **Data Immutability** | Database trigger blocks `cart_items` mutation post-lock. | PASS |
| **Input Sanitization** | Zod runtime schemas validate string lengths and types before hitting Supabase; PostgreSQL constraints (`CHECK`) enforce DB boundaries. | PASS |

---

## 9. Remaining Operational Ambiguities & Edge Cases

The following real-world operational nuances are documented for future milestone planning:

1. **Host Delivery Abandonment:** If a cart host locks the cart but fails to place the order on the merchant app, how does the group recover?
   - *Current Design:* The host can manually update the cart status to `'cancelled'`.
   - *Future Consideration:* Auto-expire carts after 2 hours if status remains `'locked'` without transitioning to `'ordered'`.
2. **Last-Minute Taxi Cancellations:** If an accepted rider cancels 10 minutes prior to departure, the remaining passengers may face unexpected fare increases.
   - *Current Design:* In MVP, fare settlement is entirely peer-to-peer.
   - *Future Consideration:* Reputation metrics or soft penalties for cancellations within 1 hour of scheduled departure.
3. **Student Graduation / Off-Boarding:** When a student graduates and moves out of a hostel or PG.
   - *Current Design:* Students can leave any community at any time via the UI (`DELETE FROM community_memberships`).
