# Yuvnix — Complete SQL Audit Bundle

**Audit Target:** Architecture v3.2 / SQL Test Harness v1.3 Working-Tree Specification  
**Base Git Commit:** `156ee1494bd3e0be7be7bc536cf50b2eaa48d11a`  
**Working Tree Status:** Working tree modified (audit remediation applied to schema and test harness files)  
**Database Target:** PostgreSQL 17.11 (Supabase Local Disposable Environment)  
**Audit Scope:** 6 Standalone PostgreSQL 17.11 SQL Source Files  

---

## Bundle Manifest

| # | File Path | Lines | Bytes | SHA-256 | Description |
|---|-----------|-------|-------|---------|-------------|
| 1 | `supabase/schema.sql` | 1389 | 53,785 | `ece9067b5ff3bc5c116f10a6f07a4b54ed8e95836ae55caf74265102ddd9509e` | Complete PostgreSQL 17.11 schema DDL, RLS policies, triggers, RPCs, privileges |
| 2 | `supabase/tests/fixtures.sql` | 243 | 15,509 | `ae4e19df126e233078e69b60375efc21e4c4ded31c2fc28394335b963ce6dccc` | Disposable test fixtures provisioning auth.users, profiles, rides, carts |
| 3 | `supabase/tests/cleanup.sql` | 62 | 2,476 | `efd8286853e4d0356f51c16d446a5aa3a52b6b0f0b41c37bcf363ec22b3adb2e` | Idempotent teardown script cascading via auth.users and dedicated test UUIDs |
| 4 | `supabase/tests/security_tests.sql` | 1011 | 41,956 | `ee944e94c5dfff35a61fb7bcf67f91795d6120bcb993ff2e9bc2299a8852fc8d` | 19 automated security unit tests validating RLS, grants, and auth context |
| 5 | `supabase/tests/concurrency_session_1.sql` | 261 | 11,035 | `0f34fca6bc0aae1aadd46a0f4ad7921e746aedb48af2739e14eda89af33de93a` | Multi-session concurrency suite: Session 1 transaction sequence |
| 6 | `supabase/tests/concurrency_session_2.sql` | 532 | 22,178 | `9500f2d0945271f4a28aff7c8c6d7d4d01017faee3cd480e296c888db41cff5c` | Multi-session concurrency suite: Session 2 transaction sequence & verifications |

---

## File 1 of 6: `supabase/schema.sql`

> **File:** `supabase/schema.sql`  
> **Lines:** 1389  
> **Bytes:** 53785  
> **SHA-256:** `ece9067b5ff3bc5c116f10a6f07a4b54ed8e95836ae55caf74265102ddd9509e`  
> **Encoding:** UTF-8  

```sql
-- =============================================================================
-- YUVNIX CONSOLIDATED DATABASE SCHEMA SPECIFICATION
-- Target: PostgreSQL 15 (Supabase Managed Cloud / Local Supabase CLI)
-- Generated from: docs/ARCHITECTURE.md (Architecture v3.2)
-- Execution: psql -h localhost -p 54322 -U postgres -d postgres -f supabase/schema.sql
-- =============================================================================

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
        -- Parent deletes cascade to cart_items after the parent row is no longer visible.
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;
        RAISE EXCEPTION 'Referenced group cart does not exist.';
    END IF;

    -- If this is an UPDATE that only touches is_fulfilled, allow host fulfillment tracking (unless cancelled)
    IF TG_OP = 'UPDATE'
       AND (OLD.item_name IS NOT DISTINCT FROM NEW.item_name)
       AND (OLD.quantity IS NOT DISTINCT FROM NEW.quantity)
       AND (OLD.unit_price_estimate IS NOT DISTINCT FROM NEW.unit_price_estimate)
       AND (OLD.notes IS NOT DISTINCT FROM NEW.notes)
       AND (OLD.cart_id IS NOT DISTINCT FROM NEW.cart_id)
       AND (OLD.added_by_user_id IS NOT DISTINCT FROM NEW.added_by_user_id) THEN
        IF v_cart_status = 'cancelled'::group_cart_status THEN
            RAISE EXCEPTION 'Cannot update items in a cancelled cart.';
        END IF;
        RETURN NEW;
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

-- 4.1b Cart Item Fulfillment Procedure (Host / Staff Only)
CREATE OR REPLACE FUNCTION public.set_cart_item_fulfillment(
    p_item_id UUID,
    p_fulfilled BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_host_id UUID;
    v_cart_status group_cart_status;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Active user session required.';
    END IF;

    SELECT gc.created_by_user_id, gc.status
    INTO v_host_id, v_cart_status
    FROM public.cart_items ci
    JOIN public.group_carts gc ON gc.id = ci.cart_id
    WHERE ci.id = p_item_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cart item does not exist.';
    END IF;

    IF auth.uid() != v_host_id AND NOT public.is_staff_or_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only the cart host or staff can update item fulfillment.';
    END IF;

    IF v_cart_status = 'cancelled'::group_cart_status THEN
        RAISE EXCEPTION 'Cannot update item fulfillment in a cancelled cart.';
    END IF;

    UPDATE public.cart_items
    SET is_fulfilled = p_fulfilled,
        updated_at = now()
    WHERE id = p_item_id;

    RETURN jsonb_build_object(
        'success', true,
        'item_id', p_item_id,
        'is_fulfilled', p_fulfilled
    );
END;
$$;

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
    v_community_id UUID;
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
    SELECT available_seats, status, departure_time, created_by_user_id, community_id
    INTO v_available, v_status, v_departure, v_host_id, v_community_id
    FROM public.shared_rides
    WHERE id = p_ride_id
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ride offer does not exist.';
    END IF;

    IF v_host_id = v_user_id THEN
        RAISE EXCEPTION 'Ride hosts cannot request seats on their own ride.';
    END IF;

    IF NOT public.is_community_member(v_community_id) AND NOT public.is_staff_or_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only active community members can request seats on this ride.';
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
    v_ride_status shared_ride_status;
    v_departure_time TIMESTAMPTZ;
    v_seats_requested INT;
    v_current_status ride_participant_status;
BEGIN
    IF v_host_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Active user session required.';
    END IF;

    -- 1. Lock shared_rides row FIRST (Lock Hierarchy Level 1)
    SELECT available_seats, status, departure_time
    INTO v_available, v_ride_status, v_departure_time
    FROM public.shared_rides
    WHERE id = p_ride_id AND created_by_user_id = v_host_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unauthorized: Only the verified ride host can accept seat requests.';
    END IF;

    -- Enforce ride lifecycle: Reject terminal states and past departures
    IF v_ride_status IN ('cancelled'::shared_ride_status, 'departed'::shared_ride_status, 'completed'::shared_ride_status) THEN
        RAISE EXCEPTION 'Cannot accept request: Ride is in terminal status: %.', v_ride_status;
    END IF;

    IF v_departure_time <= now() THEN
        RAISE EXCEPTION 'Cannot accept request: Ride departure time has already passed.';
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
    v_ride_status shared_ride_status;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Active user session required.';
    END IF;

    -- Lock Hierarchy Level 1: shared_rides
    SELECT (created_by_user_id = v_caller_id), total_seats, available_seats, status
    INTO v_is_host, v_total_seats, v_available_seats, v_ride_status
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

    -- Restore seats ONLY if the participant was previously accepted, WITHOUT reopening terminal rides
    IF v_current_status = 'accepted'::ride_participant_status THEN
        UPDATE public.shared_rides
        SET available_seats = LEAST(total_seats, available_seats + v_seats_to_release),
            status = CASE 
                WHEN v_ride_status IN ('cancelled'::shared_ride_status, 'departed'::shared_ride_status, 'completed'::shared_ride_status) 
                THEN v_ride_status
                ELSE 'open'::shared_ride_status 
            END,
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

CREATE OR REPLACE FUNCTION public.cancel_shared_ride(
    p_ride_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_host_id UUID := auth.uid();
    v_current_status shared_ride_status;
BEGIN
    IF v_host_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Active user session required.';
    END IF;

    -- 1. Lock shared_rides row FIRST (Lock Hierarchy Level 1)
    SELECT status
    INTO v_current_status
    FROM public.shared_rides
    WHERE id = p_ride_id AND created_by_user_id = v_host_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unauthorized: Only the verified ride host can cancel this ride offer.';
    END IF;

    IF v_current_status IN ('cancelled'::shared_ride_status, 'departed'::shared_ride_status, 'completed'::shared_ride_status) THEN
        RAISE EXCEPTION 'Cannot cancel ride: Ride is already in terminal status: %.', v_current_status;
    END IF;

    -- Update ride status to cancelled
    UPDATE public.shared_rides
    SET status = 'cancelled'::shared_ride_status,
        updated_at = now()
    WHERE id = p_ride_id;

    -- Cancel all pending and accepted participant reservations and notify ONLY affected riders
    WITH cancelled_riders AS (
        UPDATE public.ride_participants
        SET status = 'cancelled'::ride_participant_status
        WHERE ride_id = p_ride_id
          AND status IN ('pending'::ride_participant_status, 'accepted'::ride_participant_status)
        RETURNING user_id
    )
    INSERT INTO public.notifications (user_id, type, title, body, link_url)
    SELECT 
        user_id,
        'ride_seat_declined'::notification_type,
        'Ride Cancelled by Host',
        'The ride offer has been cancelled by the host.',
        '/rides'
    FROM cancelled_riders
    WHERE user_id != v_host_id;

    RETURN jsonb_build_object(
        'success', true,
        'ride_id', p_ride_id,
        'status', 'cancelled'
    );
END;
$$;

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

CREATE OR REPLACE FUNCTION public.is_community_member(
    p_community_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.community_memberships
        WHERE community_id = p_community_id
          AND user_id = auth.uid()
          AND is_active = true
    );
$$;

-- =============================================================================
-- 1. BASE SECURITY: REVOKE SUPABASE DEFAULTS FROM CLIENT ROLES
-- =============================================================================
-- Supabase grants broad public-schema privileges to anon/authenticated by default.
-- Remove current grants and change defaults so future objects stay closed as well.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- 2. FUNCTION EXECUTION GRANTS (AUTHENTICATED ONLY)
-- =============================================================================
GRANT EXECUTE ON FUNCTION public.is_staff_or_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_community_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_cart_item_fulfillment(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_ride_seats(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_ride_participant(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_ride_participant(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_ride_reservation(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_shared_ride(UUID) TO authenticated;
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

-- communities: Public discovery SELECT; mutations controlled strictly via staff RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communities TO authenticated;

-- community_pickup_points: Member-only SELECT; mutations controlled strictly via staff RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_pickup_points TO authenticated;

-- community_memberships: Students can request join (is_active=false) / leave; staff can activate
GRANT SELECT, INSERT, DELETE ON public.community_memberships TO authenticated;
GRANT UPDATE (is_active) ON public.community_memberships TO authenticated;

-- community_requests: Students can view & submit; staff can update review status & notes
GRANT SELECT, INSERT ON public.community_requests TO authenticated;
GRANT UPDATE (status, reviewed_by_staff_id, review_notes, created_community_id) ON public.community_requests TO authenticated;

-- group_carts: Community members can view, create & update cart metadata
GRANT SELECT, INSERT ON public.group_carts TO authenticated;
GRANT UPDATE (title, store_name, status, lock_at, pickup_instructions) ON public.group_carts TO authenticated;

-- cart_participants: Join/leave only
GRANT SELECT, INSERT, DELETE ON public.cart_participants TO authenticated;

-- cart_items: Add, view, delete, and update product details ONLY
-- cart_id and added_by_user_id are REVOKED to eliminate foreign key drift.
-- is_fulfilled is REVOKED from direct UPDATE: fulfillment status must be modified
-- exclusively through the host-only set_cart_item_fulfillment RPC.
-- is_fulfilled, created_at, updated_at are REVOKED from INSERT to eliminate workflow forgery.
GRANT SELECT, DELETE ON public.cart_items TO authenticated;
GRANT INSERT (id, cart_id, added_by_user_id, item_name, quantity, unit_price_estimate, notes) ON public.cart_items TO authenticated;
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
        public.is_community_member(community_id) OR
        public.is_staff_or_admin()
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
        public.is_community_member(community_id) OR
        public.is_staff_or_admin()
    );

CREATE POLICY "memberships_insert_authorized"
    ON public.community_memberships FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_staff_or_admin() OR
        (auth.uid() = user_id AND is_active = false AND EXISTS (
            SELECT 1 FROM public.communities c
            WHERE c.id = community_id AND c.is_verified = true
        ))
    );

CREATE POLICY "memberships_update_staff_only"
    ON public.community_memberships FOR UPDATE
    TO authenticated
    USING (public.is_staff_or_admin())
    WITH CHECK (public.is_staff_or_admin());

CREATE POLICY "memberships_delete_self"
    ON public.community_memberships FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id OR public.is_staff_or_admin());

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
        public.is_community_member(community_id) OR
        public.is_staff_or_admin()
    );

CREATE POLICY "carts_insert_community_members"
    ON public.group_carts FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = created_by_user_id AND
        public.is_community_member(community_id)
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
            WHERE gc.id = cart_participants.cart_id
              AND (public.is_community_member(gc.community_id) OR public.is_staff_or_admin())
        )
    );

CREATE POLICY "cart_participants_insert_self"
    ON public.cart_participants FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.group_carts gc
            WHERE gc.id = cart_id
              AND public.is_community_member(gc.community_id)
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
-- RLS 9: CART ITEMS (FOREIGN KEYS & WORKFLOW FIELDS PROTECTED)
-- =============================================================================
CREATE POLICY "cart_items_select"
    ON public.cart_items FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.group_carts gc
            WHERE gc.id = cart_items.cart_id
              AND (public.is_community_member(gc.community_id) OR public.is_staff_or_admin())
        )
    );

CREATE POLICY "cart_items_insert_participants"
    ON public.cart_items FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = added_by_user_id AND
        is_fulfilled = false AND
        EXISTS (
            SELECT 1 FROM public.cart_participants cp
            JOIN public.group_carts gc ON gc.id = cp.cart_id
            WHERE cp.cart_id = cart_items.cart_id
              AND cp.user_id = auth.uid()
              AND (public.is_community_member(gc.community_id) OR public.is_staff_or_admin())
        )
    );

-- Column-level privilege revokes on cart_id & added_by_user_id prevent foreign key drift directly.
-- is_fulfilled update is revoked from client column privileges; item fulfillment is governed strictly by set_cart_item_fulfillment RPC.
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
              AND (gc.created_by_user_id = auth.uid() OR public.is_staff_or_admin())
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
              AND (public.is_community_member(gc.community_id) OR public.is_staff_or_admin())
              AND (
                  gc.created_by_user_id = auth.uid() OR
                  EXISTS (
                      SELECT 1 FROM public.cart_participants cp
                      WHERE cp.cart_id = cart_messages.cart_id
                        AND cp.user_id = auth.uid()
                  )
              )
        ) OR public.is_staff_or_admin()
    );

CREATE POLICY "cart_messages_insert_members_only"
    ON public.cart_messages FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.group_carts gc
            WHERE gc.id = cart_messages.cart_id
              AND (public.is_community_member(gc.community_id) OR public.is_staff_or_admin())
              AND (
                  gc.created_by_user_id = auth.uid() OR
                  EXISTS (
                      SELECT 1 FROM public.cart_participants cp
                      WHERE cp.cart_id = cart_messages.cart_id
                        AND cp.user_id = auth.uid()
                  )
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
        public.is_community_member(community_id) OR
        public.is_staff_or_admin()
    );

CREATE POLICY "shared_rides_insert_community_members"
    ON public.shared_rides FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = created_by_user_id AND
        public.is_community_member(community_id)
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

## File 2 of 6: `supabase/tests/fixtures.sql`

> **File:** `supabase/tests/fixtures.sql`  
> **Lines:** 243  
> **Bytes:** 15509  
> **SHA-256:** `ae4e19df126e233078e69b60375efc21e4c4ded31c2fc28394335b963ce6dccc`  
> **Encoding:** UTF-8  

```sql
-- =============================================================================
-- YUVNIX SQL SECURITY & CONCURRENCY TEST FIXTURES
-- Target: Local Supabase PostgreSQL 15 Disposable Test Environment
-- Execution Role: postgres (superuser / database administrator)
-- =============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- 1. Provision Auth Users in auth.users
-- In Supabase, public.profiles and public.profile_private reference auth.users(id) ON DELETE CASCADE.
-- The trigger on_auth_user_created automatically creates student profiles upon INSERT into auth.users.
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES
    ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'alice@test.yuvnix.in', '$2a$10$abcdefghijklmnopqrstuv', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Alice Student"}'::jsonb, now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'bob@test.yuvnix.in', '$2a$10$abcdefghijklmnopqrstuv', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Bob Student"}'::jsonb, now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'charlie@test.yuvnix.in', '$2a$10$abcdefghijklmnopqrstuv', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Charlie Student"}'::jsonb, now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'carol@staff.yuvnix.in', '$2a$10$abcdefghijklmnopqrstuv', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Carol Staff"}'::jsonb, now(), now(), '', '', '', '')
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
    updated_at = now();

-- 2. Verify on_auth_user_created trigger execution before applying role elevation
DO $$
DECLARE
    v_profile_count INT;
    v_private_count INT;
BEGIN
    SELECT count(*) INTO v_profile_count 
    FROM public.profiles 
    WHERE id IN (
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222',
        '44444444-4444-4444-4444-444444444444',
        '33333333-3333-3333-3333-333333333333'
    );

    SELECT count(*) INTO v_private_count 
    FROM public.profile_private 
    WHERE id IN (
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222',
        '44444444-4444-4444-4444-444444444444',
        '33333333-3333-3333-3333-333333333333'
    );

    IF v_profile_count != 4 OR v_private_count != 4 THEN
        RAISE EXCEPTION 'FIXTURES FAILED: on_auth_user_created trigger did not create 4 profiles and 4 profile_private records (found % profiles, % private)', v_profile_count, v_private_count;
    END IF;

    RAISE NOTICE 'FIXTURES VERIFIED: on_auth_user_created trigger automatically provisioned % profiles and % private profiles.', v_profile_count, v_private_count;
END $$;

-- 3. Elevate Carol Staff role & set phone numbers (Running as postgres superuser, auth.uid() IS NULL)
UPDATE public.profiles
SET role = 'support_staff'::user_role
WHERE id = '33333333-3333-3333-3333-333333333333';

UPDATE public.profiles
SET full_name = CASE
        WHEN id = '11111111-1111-1111-1111-111111111111' THEN 'Alice Student'
        WHEN id = '22222222-2222-2222-2222-222222222222' THEN 'Bob Student'
        WHEN id = '44444444-4444-4444-4444-444444444444' THEN 'Charlie Student'
        WHEN id = '33333333-3333-3333-3333-333333333333' THEN 'Carol Staff'
    END
WHERE id IN (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '44444444-4444-4444-4444-444444444444',
    '33333333-3333-3333-3333-333333333333'
);

UPDATE public.profile_private
SET phone_number = CASE
        WHEN id = '11111111-1111-1111-1111-111111111111' THEN '+919876543210'
        WHEN id = '22222222-2222-2222-2222-222222222222' THEN '+919876543211'
        WHEN id = '44444444-4444-4444-4444-444444444444' THEN '+919876543213'
        WHEN id = '33333333-3333-3333-3333-333333333333' THEN '+919876543212'
    END
WHERE id IN (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '44444444-4444-4444-4444-444444444444',
    '33333333-3333-3333-3333-333333333333'
);

-- 4. Baseline Communities & Pickup Points
INSERT INTO public.communities (id, name, slug, type, city, is_verified) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'PDEU Hostel Block A', 'pdeu-hostel-a', 'hostel', 'Gandhinagar', true),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Sunrise PG', 'sunrise-pg', 'pg', 'Gandhinagar', true)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    is_verified = EXCLUDED.is_verified;

INSERT INTO public.community_pickup_points (id, community_id, physical_address, delivery_pickup_point, taxi_pickup_point) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Knowledge Corridor, Raisan', 'Gate 1 Security Desk', 'Gate 1 Circle Curb'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Near Bhaijipura Crossroad', 'Front Porch', 'Main Road Gate')
ON CONFLICT (id) DO UPDATE
SET delivery_pickup_point = EXCLUDED.delivery_pickup_point,
    taxi_pickup_point = EXCLUDED.taxi_pickup_point;

-- 5. Baseline Community Memberships
-- Alice is active in PDEU Hostel; Bob is active in Sunrise PG & PDEU Hostel; Charlie is active in PDEU Hostel.
-- Alice is NOT in Sunrise PG (retained for TEST-SEC-02 negative control).
INSERT INTO public.community_memberships (community_id, user_id, is_active) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', true),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', true),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', true),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', true)
ON CONFLICT (community_id, user_id) DO UPDATE
SET is_active = EXCLUDED.is_active;

-- 6. Baseline Carts & Items (for Security Unit Tests)
INSERT INTO public.group_carts (id, community_id, created_by_user_id, title, store_name, status, lock_at) VALUES
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Snacks Order', 'Blinkit', 'open', now() + interval '2 hours'),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Late Night Munches', 'Zepto', 'locked', now() - interval '10 minutes')
ON CONFLICT (id) DO UPDATE
SET status = EXCLUDED.status,
    lock_at = EXCLUDED.lock_at;

INSERT INTO public.cart_participants (cart_id, user_id) VALUES
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (cart_id, user_id) DO NOTHING;

INSERT INTO public.cart_items (id, cart_id, added_by_user_id, item_name, quantity, unit_price_estimate) VALUES
    ('cccccccc-cccc-cccc-cccc-cccccccccc01', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Organic Milk', 2, 65.00)
ON CONFLICT (id) DO UPDATE
SET quantity = EXCLUDED.quantity;

-- 7. Baseline Shared Rides (for Security Unit Tests)
INSERT INTO public.shared_rides (id, community_id, created_by_user_id, pickup_point, destination, departure_time, total_seats, available_seats, status) VALUES
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Gate 1 Circle Curb', 'SVP Airport Terminal 2', now() + interval '4 hours', 4, 1, 'open'),
    ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Gate 1 Circle Curb', 'Kalupur Railway Station', now() + interval '4 hours', 4, 2, 'open')
ON CONFLICT (id) DO UPDATE
SET available_seats = EXCLUDED.available_seats,
    status = EXCLUDED.status;

INSERT INTO public.ride_participants (ride_id, user_id, seats_reserved, status) VALUES
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222', 1, 'pending'),
    ('ffffffff-ffff-ffff-ffff-ffffffffffff', '22222222-2222-2222-2222-222222222222', 1, 'pending')
ON CONFLICT (ride_id, user_id) DO UPDATE
SET status = EXCLUDED.status,
    seats_reserved = EXCLUDED.seats_reserved;

-- 8. Baseline Pending Community Request (for Security Unit Tests)
INSERT INTO public.community_requests (id, requested_by_user_id, proposed_name, proposed_type, proposed_address, proposed_delivery_pickup_point, proposed_taxi_pickup_point, status)
VALUES ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', 'Proposed Hostel', 'hostel', 'Sector 7', 'Main Gate', 'Main Gate', 'pending')
ON CONFLICT (id) DO UPDATE
SET status = 'pending',
    reviewed_by_staff_id = NULL;

-- 9. Dedicated Isolated Fixtures for Concurrency Tests (TEST-CONC-01 to TEST-CONC-07)
-- Each concurrency test operates on its own dedicated entities, eliminating state interference.

-- 9.1 TEST-CONC-01 Ride: Two Different Students Requesting Concurrently
INSERT INTO public.shared_rides (id, community_id, created_by_user_id, pickup_point, destination, departure_time, total_seats, available_seats, status)
VALUES ('c0010000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Gate 1 Circle Curb', 'Gift City Club', now() + interval '4 hours', 4, 2, 'open')
ON CONFLICT (id) DO UPDATE SET available_seats = 2, status = 'open';
DELETE FROM public.ride_participants WHERE ride_id = 'c0010000-0000-0000-0000-000000000001';

-- 9.2 TEST-CONC-02 Ride: Rapid Duplicate Request Collision
INSERT INTO public.shared_rides (id, community_id, created_by_user_id, pickup_point, destination, departure_time, total_seats, available_seats, status)
VALUES ('c0020000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Gate 1 Circle Curb', 'Motera Stadium', now() + interval '4 hours', 4, 2, 'open')
ON CONFLICT (id) DO UPDATE SET available_seats = 2, status = 'open';
DELETE FROM public.ride_participants WHERE ride_id = 'c0020000-0000-0000-0000-000000000002';

-- 9.3 TEST-CONC-03 Ride: Two Host Sessions Accepting Final Seat
INSERT INTO public.shared_rides (id, community_id, created_by_user_id, pickup_point, destination, departure_time, total_seats, available_seats, status)
VALUES ('c0030000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Gate 1 Circle Curb', 'Infocity Gandhinagar', now() + interval '4 hours', 4, 1, 'open')
ON CONFLICT (id) DO UPDATE SET available_seats = 1, status = 'open';

INSERT INTO public.ride_participants (ride_id, user_id, seats_reserved, status) VALUES
    ('c0030000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 1, 'pending'),
    ('c0030000-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444', 1, 'pending')
ON CONFLICT (ride_id, user_id) DO UPDATE SET status = 'pending', seats_reserved = 1;

-- 9.4 TEST-CONC-04 Ride: Ride Closure vs. New Seat Request Race
INSERT INTO public.shared_rides (id, community_id, created_by_user_id, pickup_point, destination, departure_time, total_seats, available_seats, status)
VALUES ('c0040000-0000-0000-0000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Gate 1 Circle Curb', 'Ahmedabad One Mall', now() + interval '4 hours', 4, 2, 'open')
ON CONFLICT (id) DO UPDATE SET available_seats = 2, status = 'open';
DELETE FROM public.ride_participants WHERE ride_id = 'c0040000-0000-0000-0000-000000000004';

-- 9.5 TEST-CONC-05A Ride: Cancellation vs. Acceptance (Host Accept Commits First)
INSERT INTO public.shared_rides (id, community_id, created_by_user_id, pickup_point, destination, departure_time, total_seats, available_seats, status)
VALUES ('c0051000-0000-0000-0000-000000000005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Gate 1 Circle Curb', 'Kalupur Station', now() + interval '4 hours', 4, 2, 'open')
ON CONFLICT (id) DO UPDATE SET available_seats = 2, status = 'open';

INSERT INTO public.ride_participants (ride_id, user_id, seats_reserved, status)
VALUES ('c0051000-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 1, 'pending')
ON CONFLICT (ride_id, user_id) DO UPDATE SET status = 'pending', seats_reserved = 1;

-- 9.6 TEST-CONC-05B Ride: Cancellation vs. Acceptance (Rider Cancel Commits First)
INSERT INTO public.shared_rides (id, community_id, created_by_user_id, pickup_point, destination, departure_time, total_seats, available_seats, status)
VALUES ('c0052000-0000-0000-0000-000000000005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Gate 1 Circle Curb', 'Kalupur Station', now() + interval '4 hours', 4, 2, 'open')
ON CONFLICT (id) DO UPDATE SET available_seats = 2, status = 'open';

INSERT INTO public.ride_participants (ride_id, user_id, seats_reserved, status)
VALUES ('c0052000-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 1, 'pending')
ON CONFLICT (ride_id, user_id) DO UPDATE SET status = 'pending', seats_reserved = 1;

-- 9.7 TEST-CONC-06 Ride: Host Decline vs. Acceptance Race
INSERT INTO public.shared_rides (id, community_id, created_by_user_id, pickup_point, destination, departure_time, total_seats, available_seats, status)
VALUES ('c0060000-0000-0000-0000-000000000006', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Gate 1 Circle Curb', 'SVP Airport Terminal 1', now() + interval '4 hours', 4, 1, 'open')
ON CONFLICT (id) DO UPDATE SET available_seats = 1, status = 'open';

INSERT INTO public.ride_participants (ride_id, user_id, seats_reserved, status)
VALUES ('c0060000-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 1, 'pending')
ON CONFLICT (ride_id, user_id) DO UPDATE SET status = 'pending', seats_reserved = 1;

-- 9.8 TEST-CONC-07 Cart: Cart Closure vs. Concurrent Item Insertion Race
INSERT INTO public.group_carts (id, community_id, created_by_user_id, title, store_name, status, lock_at)
VALUES ('c0070000-0000-0000-0000-000000000007', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Concurrency Test Cart', 'Blinkit', 'open', now() + interval '2 hours')
ON CONFLICT (id) DO UPDATE SET status = 'open', lock_at = now() + interval '2 hours';

INSERT INTO public.cart_participants (cart_id, user_id)
VALUES ('c0070000-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (cart_id, user_id) DO NOTHING;

DELETE FROM public.cart_items WHERE cart_id = 'c0070000-0000-0000-0000-000000000007';

COMMIT;

SELECT 'Test fixtures and concurrency suites successfully provisioned.' AS status;
```

---

## File 3 of 6: `supabase/tests/cleanup.sql`

> **File:** `supabase/tests/cleanup.sql`  
> **Lines:** 62  
> **Bytes:** 2476  
> **SHA-256:** `efd8286853e4d0356f51c16d446a5aa3a52b6b0f0b41c37bcf363ec22b3adb2e`  
> **Encoding:** UTF-8  

```sql
-- =============================================================================
-- YUVNIX SQL SECURITY & CONCURRENCY TEST FIXTURES TEARDOWN
-- Target: Local Supabase PostgreSQL 15 Disposable Test Environment
-- Execution: psql -h localhost -p 54322 -U postgres -d postgres -f supabase/tests/cleanup.sql
-- =============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- 1. Remove temporary notifications
DELETE FROM public.notifications WHERE id = '99999999-9999-9999-9999-999999999999';

-- 2. Remove fixture community requests
DELETE FROM public.community_requests WHERE id = '77777777-7777-7777-7777-777777777777';

-- 3. Remove dedicated concurrency test rides (cascades to ride_participants & ride_messages)
DELETE FROM public.shared_rides WHERE id IN (
    'c0010000-0000-0000-0000-000000000001',
    'c0020000-0000-0000-0000-000000000002',
    'c0030000-0000-0000-0000-000000000003',
    'c0040000-0000-0000-0000-000000000004',
    'c0051000-0000-0000-0000-000000000005',
    'c0052000-0000-0000-0000-000000000005',
    'c0060000-0000-0000-0000-000000000006'
);

-- 4. Remove baseline fixture rides (cascades to ride_participants & ride_messages)
DELETE FROM public.shared_rides WHERE id IN (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'ffffffff-ffff-ffff-ffff-ffffffffffff'
);

-- 5. Remove dedicated concurrency test carts (cascades to cart_participants, cart_items, & cart_messages)
DELETE FROM public.group_carts WHERE id IN (
    'c0070000-0000-0000-0000-000000000007'
);

-- 6. Remove baseline fixture carts (cascades to cart_participants, cart_items, & cart_messages)
DELETE FROM public.group_carts WHERE id IN (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'dddddddd-dddd-dddd-dddd-dddddddddddd'
);

-- 7. Remove all fixture communities strictly by dedicated fixture IDs (cascades to pickup points, memberships)
DELETE FROM public.communities WHERE id IN (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '88888888-8888-8888-8888-888888888888'
);

-- 8. Remove test users from auth.users (cascades to profiles, profile_private, memberships, etc.)
DELETE FROM auth.users WHERE id IN (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '44444444-4444-4444-4444-444444444444',
    '33333333-3333-3333-3333-333333333333'
);

COMMIT;

SELECT 'All Yuvnix test fixtures successfully and idempotently cleaned up.' AS status;
```

---

## File 4 of 6: `supabase/tests/security_tests.sql`

> **File:** `supabase/tests/security_tests.sql`  
> **Lines:** 1011  
> **Bytes:** 41956  
> **SHA-256:** `ee944e94c5dfff35a61fb7bcf67f91795d6120bcb993ff2e9bc2299a8852fc8d`  
> **Encoding:** UTF-8  

```sql
-- =============================================================================
-- YUVNIX SQL SECURITY CONTROL TEST SUITE (TEST-SEC-01 TO TEST-SEC-13B)
-- Target: Local Supabase PostgreSQL 15 Disposable Test Environment
-- Execution: psql -h localhost -p 54322 -U postgres -d postgres -f supabase/tests/security_tests.sql
-- =============================================================================

\set ON_ERROR_STOP on

-- =============================================================================
-- TEST-SEC-01: Student Role Escalation
-- =============================================================================
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '11111111-1111-1111-1111-111111111111',
    'role', 'authenticated'
)::text, true);

DO $$
DECLARE
    v_succeeded BOOLEAN := false;
    v_sqlstate TEXT;
BEGIN
    -- Pre-flight auth verification
    IF auth.uid() IS NULL OR auth.uid() != '11111111-1111-1111-1111-111111111111'::uuid THEN
        RAISE EXCEPTION 'Authentication context failure: auth.uid() is % (expected 11111111-1111-1111-1111-111111111111)', auth.uid();
    END IF;
    IF auth.role() IS NULL OR auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Authentication context failure: auth.role() is % (expected authenticated)', auth.role();
    END IF;

    -- Unauthorized role escalation attempt
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

    RAISE NOTICE 'TEST-SEC-01 PASSED: Role escalation blocked (SQLSTATE: %)', v_sqlstate;
END $$;
ROLLBACK;


-- =============================================================================
-- TEST-SEC-02: Community Pickup-Point Privacy (Positive & Negative Controls)
-- =============================================================================
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '11111111-1111-1111-1111-111111111111',
    'role', 'authenticated'
)::text, true);

DO $$
DECLARE
    v_delivery TEXT;
    v_taxi TEXT;
    v_unauthorized_count INT;
BEGIN
    -- Pre-flight auth verification
    IF auth.uid() IS NULL OR auth.uid() != '11111111-1111-1111-1111-111111111111'::uuid THEN
        RAISE EXCEPTION 'Authentication context failure: auth.uid() is % (expected 11111111-1111-1111-1111-111111111111)', auth.uid();
    END IF;
    IF auth.role() IS NULL OR auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Authentication context failure: auth.role() is % (expected authenticated)', auth.role();
    END IF;

    -- 1. Positive Control: Active member must retrieve their joined community pickup point
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

    -- 2. Negative Control: Non-member must receive 0 rows from unjoined community
    SELECT count(*) INTO v_unauthorized_count 
    FROM public.community_pickup_points 
    WHERE community_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

    IF v_unauthorized_count > 0 THEN
        RAISE EXCEPTION 'TEST-SEC-02 FAILED: Negative control breached; non-member read % rows from unjoined community!', v_unauthorized_count;
    END IF;

    RAISE NOTICE 'TEST-SEC-02 PASSED: Positive control matched exact fixture; negative control returned 0 rows.';
END $$;
ROLLBACK;


-- =============================================================================
-- TEST-SEC-03: Cart Chat Access Isolation
-- =============================================================================
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222'; -- Bob (not in Alice's cart)
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '22222222-2222-2222-2222-222222222222',
    'role', 'authenticated'
)::text, true);

DO $$
DECLARE
    v_succeeded BOOLEAN := false;
    v_sqlstate TEXT;
BEGIN
    -- Pre-flight auth verification
    IF auth.uid() IS NULL OR auth.uid() != '22222222-2222-2222-2222-222222222222'::uuid THEN
        RAISE EXCEPTION 'Authentication context failure: auth.uid() is % (expected 22222222-2222-2222-2222-222222222222)', auth.uid();
    END IF;
    IF auth.role() IS NULL OR auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Authentication context failure: auth.role() is % (expected authenticated)', auth.role();
    END IF;

    -- Unauthorized cart message insertion attempt
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


-- =============================================================================
-- TEST-SEC-03B: Cart Chat Access Rejection After Membership Deactivation
-- =============================================================================
BEGIN;
-- Setup fixture state before switching role:
-- Bob is an existing participant in Alice's cart cccccccc-cccc-cccc-cccc-cccccccccccc,
-- but his membership in community aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa is deactivated (is_active = false).
INSERT INTO public.cart_participants (cart_id, user_id)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222')
ON CONFLICT (cart_id, user_id) DO NOTHING;

UPDATE public.community_memberships
SET is_active = false
WHERE community_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  AND user_id = '22222222-2222-2222-2222-222222222222';

-- Now switch to Bob (authenticated)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '22222222-2222-2222-2222-222222222222',
    'role', 'authenticated'
)::text, true);

DO $$
DECLARE
    v_msg_count INT;
    v_insert_ok BOOLEAN := false;
    v_sqlstate TEXT;
BEGIN
    -- Pre-flight auth verification
    IF auth.uid() IS NULL OR auth.uid() != '22222222-2222-2222-2222-222222222222'::uuid THEN
        RAISE EXCEPTION 'Authentication context failure: auth.uid() is % (expected 22222222-2222-2222-2222-222222222222)', auth.uid();
    END IF;
    IF auth.role() IS NULL OR auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Authentication context failure: auth.role() is % (expected authenticated)', auth.role();
    END IF;

    -- 1. SELECT verification: Deactivated member must receive 0 rows despite being in cart_participants
    SELECT count(*) INTO v_msg_count
    FROM public.cart_messages
    WHERE cart_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

    IF v_msg_count > 0 THEN
        RAISE EXCEPTION 'TEST-SEC-03B FAILED: Deactivated community member read % cart messages!', v_msg_count;
    END IF;

    -- 2. INSERT verification: Deactivated member cannot insert cart messages
    BEGIN
        INSERT INTO public.cart_messages (cart_id, sender_id, message_text)
        VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'Deactivated resident message');
        v_insert_ok := true;
    EXCEPTION WHEN insufficient_privilege THEN
        v_sqlstate := SQLSTATE;
    END;

    IF v_insert_ok THEN
        RAISE EXCEPTION 'TEST-SEC-03B FAILED: Deactivated community member successfully sent a cart message!';
    END IF;

    RAISE NOTICE 'TEST-SEC-03B PASSED: Deactivated resident read 0 rows; INSERT rejected with SQLSTATE %.', v_sqlstate;
END $$;
ROLLBACK;


-- =============================================================================
-- TEST-SEC-04: Ride Chat Access Isolation
-- =============================================================================
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222'; -- Bob (status is pending)
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '22222222-2222-2222-2222-222222222222',
    'role', 'authenticated'
)::text, true);

DO $$
DECLARE
    v_succeeded BOOLEAN := false;
    v_count INT;
    v_sqlstate TEXT;
BEGIN
    -- Pre-flight auth verification
    IF auth.uid() IS NULL OR auth.uid() != '22222222-2222-2222-2222-222222222222'::uuid THEN
        RAISE EXCEPTION 'Authentication context failure: auth.uid() is % (expected 22222222-2222-2222-2222-222222222222)', auth.uid();
    END IF;
    IF auth.role() IS NULL OR auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Authentication context failure: auth.role() is % (expected authenticated)', auth.role();
    END IF;

    -- 1. Read check: pending rider must read 0 rows
    SELECT count(*) INTO v_count 
    FROM public.ride_messages 
    WHERE ride_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

    IF v_count > 0 THEN
        RAISE EXCEPTION 'TEST-SEC-04 FAILED: Pending rider was able to read ride messages!';
    END IF;

    -- 2. Write check: pending rider must not post messages
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


-- =============================================================================
-- TEST-SEC-05: Direct Mutations on ride_participants
-- =============================================================================
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '22222222-2222-2222-2222-222222222222',
    'role', 'authenticated'
)::text, true);

DO $$
DECLARE
    v_insert_ok BOOLEAN := false;
    v_update_ok BOOLEAN := false;
    v_delete_ok BOOLEAN := false;
BEGIN
    -- Pre-flight auth verification
    IF auth.uid() IS NULL OR auth.uid() != '22222222-2222-2222-2222-222222222222'::uuid THEN
        RAISE EXCEPTION 'Authentication context failure: auth.uid() is % (expected 22222222-2222-2222-2222-222222222222)', auth.uid();
    END IF;
    IF auth.role() IS NULL OR auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Authentication context failure: auth.role() is % (expected authenticated)', auth.role();
    END IF;

    -- Verify Supabase default table grants did not override the intended ACL matrix.
    IF has_table_privilege('authenticated', 'public.ride_participants', 'INSERT')
       OR has_table_privilege('authenticated', 'public.ride_participants', 'UPDATE')
       OR has_table_privilege('authenticated', 'public.ride_participants', 'DELETE') THEN
        RAISE EXCEPTION 'TEST-SEC-05 FAILED: authenticated retains table-level ride_participants mutation privileges.';
    END IF;

    IF has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE')
       OR has_column_privilege('authenticated', 'public.profile_private', 'email', 'UPDATE')
       OR has_column_privilege('authenticated', 'public.group_carts', 'community_id', 'UPDATE')
       OR has_column_privilege('authenticated', 'public.cart_items', 'cart_id', 'UPDATE')
       OR has_column_privilege('authenticated', 'public.cart_items', 'added_by_user_id', 'UPDATE')
       OR has_column_privilege('authenticated', 'public.cart_items', 'is_fulfilled', 'UPDATE')
       OR has_column_privilege('authenticated', 'public.shared_rides', 'available_seats', 'UPDATE')
       OR has_column_privilege('authenticated', 'public.shared_rides', 'status', 'UPDATE') THEN
        RAISE EXCEPTION 'TEST-SEC-05 FAILED: Supabase default grants exposed a protected column.';
    END IF;

    -- 1. Direct INSERT attempt
    BEGIN
        INSERT INTO public.ride_participants (ride_id, user_id, seats_reserved, status)
        VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '22222222-2222-2222-2222-222222222222', 1, 'accepted');
        v_insert_ok := true;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;

    -- 2. Direct UPDATE attempt
    BEGIN
        UPDATE public.ride_participants 
        SET status = 'accepted'::ride_participant_status 
        WHERE ride_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' AND user_id = '22222222-2222-2222-2222-222222222222';
        v_update_ok := true;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;

    -- 3. Direct DELETE attempt
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


-- =============================================================================
-- TEST-SEC-06: Cart Item cart_id Foreign Key Tampering
-- =============================================================================
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '11111111-1111-1111-1111-111111111111',
    'role', 'authenticated'
)::text, true);

DO $$
DECLARE
    v_succeeded BOOLEAN := false;
    v_sqlstate TEXT;
BEGIN
    -- Pre-flight auth verification
    IF auth.uid() IS NULL OR auth.uid() != '11111111-1111-1111-1111-111111111111'::uuid THEN
        RAISE EXCEPTION 'Authentication context failure: auth.uid() is % (expected 11111111-1111-1111-1111-111111111111)', auth.uid();
    END IF;
    IF auth.role() IS NULL OR auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Authentication context failure: auth.role() is % (expected authenticated)', auth.role();
    END IF;

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


-- =============================================================================
-- TEST-SEC-07: Cart Item added_by_user_id Tampering
-- =============================================================================
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '11111111-1111-1111-1111-111111111111',
    'role', 'authenticated'
)::text, true);

DO $$
DECLARE
    v_succeeded BOOLEAN := false;
    v_sqlstate TEXT;
BEGIN
    -- Pre-flight auth verification
    IF auth.uid() IS NULL OR auth.uid() != '11111111-1111-1111-1111-111111111111'::uuid THEN
        RAISE EXCEPTION 'Authentication context failure: auth.uid() is % (expected 11111111-1111-1111-1111-111111111111)', auth.uid();
    END IF;
    IF auth.role() IS NULL OR auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Authentication context failure: auth.role() is % (expected authenticated)', auth.role();
    END IF;

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


-- =============================================================================
-- TEST-SEC-08: Notification Forgery
-- =============================================================================
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '11111111-1111-1111-1111-111111111111',
    'role', 'authenticated'
)::text, true);

DO $$
DECLARE
    v_succeeded BOOLEAN := false;
    v_sqlstate TEXT;
BEGIN
    -- Pre-flight auth verification
    IF auth.uid() IS NULL OR auth.uid() != '11111111-1111-1111-1111-111111111111'::uuid THEN
        RAISE EXCEPTION 'Authentication context failure: auth.uid() is % (expected 11111111-1111-1111-1111-111111111111)', auth.uid();
    END IF;
    IF auth.role() IS NULL OR auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Authentication context failure: auth.role() is % (expected authenticated)', auth.role();
    END IF;

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


-- =============================================================================
-- TEST-SEC-09: Notification Title and Body Modification
-- =============================================================================
BEGIN;
-- Insert isolated test notification as postgres superuser
INSERT INTO public.notifications (id, user_id, type, title, body)
VALUES ('99999999-9999-9999-9999-999999999999', '11111111-1111-1111-1111-111111111111', 'cart_lock_imminent', 'Test Alert', 'Original Content')
ON CONFLICT (id) DO NOTHING;

-- Switch strictly using SET LOCAL ROLE
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '11111111-1111-1111-1111-111111111111',
    'role', 'authenticated'
)::text, true);

DO $$
DECLARE
    v_succeeded BOOLEAN := false;
    v_sqlstate TEXT;
BEGIN
    -- Pre-flight auth verification
    IF auth.uid() IS NULL OR auth.uid() != '11111111-1111-1111-1111-111111111111'::uuid THEN
        RAISE EXCEPTION 'Authentication context failure: auth.uid() is % (expected 11111111-1111-1111-1111-111111111111)', auth.uid();
    END IF;
    IF auth.role() IS NULL OR auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Authentication context failure: auth.role() is % (expected authenticated)', auth.role();
    END IF;

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


-- =============================================================================
-- TEST-SEC-10A-1: Student Community Creation Rejection (Isolated)
-- =============================================================================
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '11111111-1111-1111-1111-111111111111',
    'role', 'authenticated'
)::text, true);

DO $$
DECLARE
    v_student_ok BOOLEAN := false;
BEGIN
    -- Pre-flight auth verification
    IF auth.uid() IS NULL OR auth.uid() != '11111111-1111-1111-1111-111111111111'::uuid THEN
        RAISE EXCEPTION 'Authentication context failure: auth.uid() is % (expected 11111111-1111-1111-1111-111111111111)', auth.uid();
    END IF;
    IF auth.role() IS NULL OR auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Authentication context failure: auth.role() is % (expected authenticated)', auth.role();
    END IF;

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


-- =============================================================================
-- TEST-SEC-10A-2: Support Staff Authorized Creation (Isolated)
-- =============================================================================
BEGIN;
-- Ensure cleanup from previous test runs as postgres superuser
DELETE FROM public.communities WHERE slug = 'staff-created-comm-test' OR id = '88888888-8888-8888-8888-888888888888';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333'; -- Carol Staff
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '33333333-3333-3333-3333-333333333333',
    'role', 'authenticated'
)::text, true);

DO $$
BEGIN
    -- Pre-flight auth verification
    IF auth.uid() IS NULL OR auth.uid() != '33333333-3333-3333-3333-333333333333'::uuid THEN
        RAISE EXCEPTION 'Authentication context failure: auth.uid() is % (expected 33333333-3333-3333-3333-333333333333)', auth.uid();
    END IF;
    IF auth.role() IS NULL OR auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Authentication context failure: auth.role() is % (expected authenticated)', auth.role();
    END IF;
END $$;

INSERT INTO public.communities (id, name, slug, type, city, is_verified)
VALUES ('88888888-8888-8888-8888-888888888888', 'Staff Verified Residence', 'staff-created-comm-test', 'hostel', 'Gandhinagar', true);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.communities WHERE id = '88888888-8888-8888-8888-888888888888') THEN
        RAISE EXCEPTION 'TEST-SEC-10A-2 FAILED: Staff insert did not persist in database!';
    END IF;
    RAISE NOTICE 'TEST-SEC-10A-2 PASSED: Authenticated staff member successfully created community.';
END $$;
ROLLBACK;


-- =============================================================================
-- TEST-SEC-10B-1: Student Self-Approval Rejection (Isolated)
-- =============================================================================
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '11111111-1111-1111-1111-111111111111',
    'role', 'authenticated'
)::text, true);

DO $$
DECLARE
    v_rows_updated INT;
    v_status community_request_status;
BEGIN
    -- Pre-flight auth verification
    IF auth.uid() IS NULL OR auth.uid() != '11111111-1111-1111-1111-111111111111'::uuid THEN
        RAISE EXCEPTION 'Authentication context failure: auth.uid() is % (expected 11111111-1111-1111-1111-111111111111)', auth.uid();
    END IF;
    IF auth.role() IS NULL OR auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Authentication context failure: auth.role() is % (expected authenticated)', auth.role();
    END IF;

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


-- =============================================================================
-- TEST-SEC-10B-2: Support Staff Authorized Approval (Isolated)
-- =============================================================================
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333'; -- Carol Staff
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '33333333-3333-3333-3333-333333333333',
    'role', 'authenticated'
)::text, true);

DO $$
BEGIN
    -- Pre-flight auth verification
    IF auth.uid() IS NULL OR auth.uid() != '33333333-3333-3333-3333-333333333333'::uuid THEN
        RAISE EXCEPTION 'Authentication context failure: auth.uid() is % (expected 33333333-3333-3333-3333-333333333333)', auth.uid();
    END IF;
    IF auth.role() IS NULL OR auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Authentication context failure: auth.role() is % (expected authenticated)', auth.role();
    END IF;
END $$;

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


-- =============================================================================
-- TEST-SEC-11: Community Membership Active Self-Enrollment Rejection (Finding 2)
-- =============================================================================
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '11111111-1111-1111-1111-111111111111',
    'role', 'authenticated'
)::text, true);

DO $$
DECLARE
    v_succeeded BOOLEAN := false;
    v_sqlstate TEXT;
BEGIN
    -- Pre-flight auth verification
    IF auth.uid() IS NULL OR auth.uid() != '11111111-1111-1111-1111-111111111111'::uuid THEN
        RAISE EXCEPTION 'Authentication context failure: auth.uid() is % (expected 11111111-1111-1111-1111-111111111111)', auth.uid();
    END IF;
    IF auth.role() IS NULL OR auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Authentication context failure: auth.role() is % (expected authenticated)', auth.role();
    END IF;

    -- Attempt unauthorized active self-enrollment into Sunrise PG to unlock private pickup coordinates
    BEGIN
        INSERT INTO public.community_memberships (community_id, user_id, is_active)
        VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', true);
        v_succeeded := true;
    EXCEPTION WHEN insufficient_privilege THEN
        v_sqlstate := SQLSTATE;
    END;

    IF v_succeeded THEN
        RAISE EXCEPTION 'TEST-SEC-11 FAILED: Student directly self-enrolled with is_active=true!';
    END IF;

    RAISE NOTICE 'TEST-SEC-11 PASSED: Active self-enrollment blocked with SQLSTATE % (authorized approval flow required).', v_sqlstate;
END $$;
ROLLBACK;


-- =============================================================================
-- TEST-SEC-12: Cart Item Workflow Fulfillment State & Timestamp Forgery Rejection (Finding 8)
-- =============================================================================
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '11111111-1111-1111-1111-111111111111',
    'role', 'authenticated'
)::text, true);

DO $$
DECLARE
    v_succeeded BOOLEAN := false;
    v_sqlstate TEXT;
BEGIN
    -- Pre-flight auth verification
    IF auth.uid() IS NULL OR auth.uid() != '11111111-1111-1111-1111-111111111111'::uuid THEN
        RAISE EXCEPTION 'Authentication context failure: auth.uid() is % (expected 11111111-1111-1111-1111-111111111111)', auth.uid();
    END IF;
    IF auth.role() IS NULL OR auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Authentication context failure: auth.role() is % (expected authenticated)', auth.role();
    END IF;

    -- Attempt to insert cart item with forged is_fulfilled=true state
    BEGIN
        INSERT INTO public.cart_items (id, cart_id, added_by_user_id, item_name, quantity, is_fulfilled)
        VALUES ('99999999-9999-9999-9999-999999999991', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Forged Fulfilled Item', 1, true);
        v_succeeded := true;
    EXCEPTION WHEN insufficient_privilege THEN
        v_sqlstate := SQLSTATE;
    END;

    IF v_succeeded THEN
        RAISE EXCEPTION 'TEST-SEC-12 FAILED: Participant inserted item with forged is_fulfilled=true!';
    END IF;

    RAISE NOTICE 'TEST-SEC-12 PASSED: Direct is_fulfilled insertion blocked with SQLSTATE % (workflow fields protected).', v_sqlstate;
END $$;
ROLLBACK;


-- =============================================================================
-- TEST-SEC-12B: Non-Host Cart Item Owner Fulfillment Protection & Host Fulfillment Control
-- =============================================================================
BEGIN;
-- Setup fixture state before switching role:
-- Bob joins Alice's cart cccccccc-cccc-cccc-cccc-cccccccccccc and adds an item
INSERT INTO public.cart_participants (cart_id, user_id)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222')
ON CONFLICT (cart_id, user_id) DO NOTHING;

INSERT INTO public.cart_items (id, cart_id, added_by_user_id, item_name, quantity, unit_price_estimate, is_fulfilled)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccc02', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'Bob Energy Drink', 1, 120.00, false)
ON CONFLICT (id) DO UPDATE SET is_fulfilled = false;

-- Phase 1: Authenticate as Bob (item owner, NOT cart host)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '22222222-2222-2222-2222-222222222222',
    'role', 'authenticated'
)::text, true);

DO $$
DECLARE
    v_update_succeeded BOOLEAN := false;
    v_rpc_succeeded BOOLEAN := false;
    v_update_sqlstate TEXT;
    v_rpc_sqlstate TEXT;
BEGIN
    -- Pre-flight auth verification
    IF auth.uid() IS NULL OR auth.uid() != '22222222-2222-2222-2222-222222222222'::uuid THEN
        RAISE EXCEPTION 'Auth error: auth.uid() is %', auth.uid();
    END IF;

    -- 1. Direct UPDATE attempt by non-host item owner (blocked by column privilege revocation)
    BEGIN
        UPDATE public.cart_items
        SET is_fulfilled = true
        WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccc02';
        v_update_succeeded := true;
    EXCEPTION WHEN insufficient_privilege THEN
        v_update_sqlstate := SQLSTATE;
    END;

    IF v_update_succeeded THEN
        RAISE EXCEPTION 'TEST-SEC-12B FAILED: Non-host item owner directly modified is_fulfilled!';
    END IF;

    -- 2. Fulfillment RPC call attempt by non-host item owner (blocked by host authorization check)
    BEGIN
        PERFORM public.set_cart_item_fulfillment('cccccccc-cccc-cccc-cccc-cccccccccc02', true);
        v_rpc_succeeded := true;
    EXCEPTION WHEN raise_exception THEN
        v_rpc_sqlstate := SQLSTATE;
    END;

    IF v_rpc_succeeded THEN
        RAISE EXCEPTION 'TEST-SEC-12B FAILED: Non-host item owner modified is_fulfilled via RPC!';
    END IF;

    RAISE NOTICE 'TEST-SEC-12B Phase 1 PASSED: Non-host item owner rejected via direct UPDATE (SQLSTATE: %) and RPC (SQLSTATE: %)', v_update_sqlstate, v_rpc_sqlstate;
END $$;

-- Phase 2: Switch to Alice (cart host)
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '11111111-1111-1111-1111-111111111111',
    'role', 'authenticated'
)::text, true);

DO $$
DECLARE
    v_result JSONB;
    v_is_fulfilled BOOLEAN;
BEGIN
    -- Pre-flight auth verification
    IF auth.uid() IS NULL OR auth.uid() != '11111111-1111-1111-1111-111111111111'::uuid THEN
        RAISE EXCEPTION 'Auth error: auth.uid() is %', auth.uid();
    END IF;

    -- Host marks participant item fulfilled via dedicated RPC
    v_result := public.set_cart_item_fulfillment('cccccccc-cccc-cccc-cccc-cccccccccc02', true);

    IF (v_result->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST-SEC-12B FAILED: Host fulfillment RPC did not return success!';
    END IF;

    SELECT is_fulfilled INTO v_is_fulfilled
    FROM public.cart_items
    WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccc02';

    IF v_is_fulfilled IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST-SEC-12B FAILED: Cart item is_fulfilled is not true after host fulfillment!';
    END IF;

    RAISE NOTICE 'TEST-SEC-12B Phase 2 PASSED: Cart host successfully marked participant item fulfilled.';
END $$;
ROLLBACK;


-- =============================================================================
-- TEST-SEC-13: Ride Lifecycle Enforcement on Acceptance (Finding 3)
-- =============================================================================
BEGIN;
-- Setup: Cancel ride eeeeeeee as host via cancel_shared_ride
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '11111111-1111-1111-1111-111111111111',
    'role', 'authenticated'
)::text, true);

SELECT public.cancel_shared_ride('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');

-- Attempt to accept Bob on the cancelled ride
DO $$
DECLARE
    v_succeeded BOOLEAN := false;
    v_sqlstate TEXT;
    v_sqlerrm TEXT;
BEGIN
    BEGIN
        PERFORM public.accept_ride_participant('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222');
        v_succeeded := true;
    EXCEPTION WHEN raise_exception THEN
        v_sqlstate := SQLSTATE;
        v_sqlerrm := SQLERRM;
    END;

    IF v_succeeded THEN
        RAISE EXCEPTION 'TEST-SEC-13 FAILED: Host accept succeeded on cancelled ride!';
    END IF;

    IF v_sqlstate != 'P0001' OR v_sqlerrm NOT LIKE '%terminal status: cancelled%' THEN
        RAISE EXCEPTION 'TEST-SEC-13 FAILED: Unexpected error condition (SQLSTATE: %, Message: %)', v_sqlstate, v_sqlerrm;
    END IF;

    RAISE NOTICE 'TEST-SEC-13 PASSED: Host accept on cancelled ride rejected with SQLSTATE % (Message: %)', v_sqlstate, v_sqlerrm;
END $$;
ROLLBACK;


-- =============================================================================
-- TEST-SEC-13B: Ride Cancellation Notification Targeting (Pending/Accepted Only)
-- =============================================================================
BEGIN;
-- Setup fixture state before switching role:
-- Ride ffffffff-ffff-ffff-ffff-ffffffffffff is hosted by Alice (11111111-1111-1111-1111-111111111111).
-- Bob (22222222-2222-2222-2222-222222222222) has status 'accepted'.
-- Charlie (44444444-4444-4444-4444-444444444444) has status 'declined'.
UPDATE public.shared_rides
SET status = 'open'::shared_ride_status,
    departure_time = now() + interval '4 hours'
WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

INSERT INTO public.ride_participants (ride_id, user_id, seats_reserved, status)
VALUES
    ('ffffffff-ffff-ffff-ffff-ffffffffffff', '22222222-2222-2222-2222-222222222222', 1, 'accepted'::ride_participant_status),
    ('ffffffff-ffff-ffff-ffff-ffffffffffff', '44444444-4444-4444-4444-444444444444', 1, 'declined'::ride_participant_status)
ON CONFLICT (ride_id, user_id) DO UPDATE
SET status = EXCLUDED.status,
    seats_reserved = EXCLUDED.seats_reserved;

-- Delete any pre-existing cancellation notifications for clean assertion
DELETE FROM public.notifications
WHERE user_id IN ('22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444')
  AND title = 'Ride Cancelled by Host';

-- Authenticate as Host Alice
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '11111111-1111-1111-1111-111111111111',
    'role', 'authenticated'
)::text, true);

DO $$
BEGIN
    -- Pre-flight auth verification
    IF auth.uid() IS NULL OR auth.uid() != '11111111-1111-1111-1111-111111111111'::uuid THEN
        RAISE EXCEPTION 'Auth error: auth.uid() is %', auth.uid();
    END IF;

    -- Alice cancels the shared ride
    PERFORM public.cancel_shared_ride('ffffffff-ffff-ffff-ffff-ffffffffffff');
END $$;

-- Switch to Bob (accepted rider) to verify notification under self-only RLS
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '22222222-2222-2222-2222-222222222222',
    'role', 'authenticated'
)::text, true);

DO $$
DECLARE
    v_bob_notifs INT;
BEGIN
    SELECT count(*) INTO v_bob_notifs
    FROM public.notifications
    WHERE user_id = '22222222-2222-2222-2222-222222222222'
      AND title = 'Ride Cancelled by Host';

    IF v_bob_notifs != 1 THEN
        RAISE EXCEPTION 'TEST-SEC-13B FAILED: Accepted rider received % notifications (expected 1)!', v_bob_notifs;
    END IF;
END $$;

-- Switch to Charlie (declined rider) to verify no notification under self-only RLS
SET LOCAL "request.jwt.claim.sub" = '44444444-4444-4444-4444-444444444444';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '44444444-4444-4444-4444-444444444444',
    'role', 'authenticated'
)::text, true);

DO $$
DECLARE
    v_charlie_notifs INT;
BEGIN
    SELECT count(*) INTO v_charlie_notifs
    FROM public.notifications
    WHERE user_id = '44444444-4444-4444-4444-444444444444'
      AND title = 'Ride Cancelled by Host';

    IF v_charlie_notifs != 0 THEN
        RAISE EXCEPTION 'TEST-SEC-13B FAILED: Declined rider received % notifications (expected 0)!', v_charlie_notifs;
    END IF;

    RAISE NOTICE 'TEST-SEC-13B PASSED: Only active/accepted rider notified (1); declined rider not notified (0).';
END $$;
ROLLBACK;

SELECT 'All 19 Security Unit Tests PASSED under authenticated role simulation.' AS final_result;
```

---

## File 5 of 6: `supabase/tests/concurrency_session_1.sql`

> **File:** `supabase/tests/concurrency_session_1.sql`  
> **Lines:** 261  
> **Bytes:** 11035  
> **SHA-256:** `0f34fca6bc0aae1aadd46a0f4ad7921e746aedb48af2739e14eda89af33de93a`  
> **Encoding:** UTF-8  

```sql
-- =============================================================================
-- YUVNIX MULTI-SESSION CONCURRENCY TEST SUITE: SESSION 1
-- Target: Local Supabase PostgreSQL 15 Disposable Test Environment
-- Execution: Run in Terminal Window 1 step-by-step
-- Coordinate with supabase/tests/concurrency_session_2.sql in Terminal Window 2
-- =============================================================================

\set ON_ERROR_STOP on

-- =============================================================================
-- TEST-CONC-01: Two Different Students Requesting Same Ride Concurrently
-- =============================================================================
-- Terminal 1 (Student B: Bob)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '22222222-2222-2222-2222-222222222222',
    'role', 'authenticated'
)::text, true);

DO $$
BEGIN
    IF auth.uid() IS NULL OR auth.uid() != '22222222-2222-2222-2222-222222222222'::uuid THEN
        RAISE EXCEPTION 'Auth error: auth.uid() is %', auth.uid();
    END IF;
    IF auth.role() IS NULL OR auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Auth error: auth.role() is %', auth.role();
    END IF;
END $$;

SELECT public.request_ride_seats('c0010000-0000-0000-0000-000000000001', 1);
-- PAUSE: Wait for Terminal 2 to execute its request concurrently.
COMMIT;


-- =============================================================================
-- TEST-CONC-02: Same Student Rapid Double Request (Unique Constraint Collision)
-- =============================================================================
-- Terminal 1 (Student B: Bob, Tab 1)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '22222222-2222-2222-2222-222222222222',
    'role', 'authenticated'
)::text, true);

DO $$
BEGIN
    IF auth.uid() IS NULL OR auth.uid() != '22222222-2222-2222-2222-222222222222'::uuid THEN
        RAISE EXCEPTION 'Auth error: auth.uid() is %', auth.uid();
    END IF;
    IF auth.role() IS NULL OR auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Auth error: auth.role() is %', auth.role();
    END IF;
END $$;

SELECT public.request_ride_seats('c0020000-0000-0000-0000-000000000002', 1);
-- PAUSE: Do not commit yet. Hold tuple lock on (ride_id, user_id).
-- Instruct Terminal 2 to execute its duplicate request (Terminal 2 will block).
COMMIT;


-- =============================================================================
-- TEST-CONC-03: Two Host Sessions Accepting Final Available Seat
-- =============================================================================
-- Terminal 1 (Host Alice: Accepts Bob)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '11111111-1111-1111-1111-111111111111',
    'role', 'authenticated'
)::text, true);

DO $$
BEGIN
    IF auth.uid() IS NULL OR auth.uid() != '11111111-1111-1111-1111-111111111111'::uuid THEN
        RAISE EXCEPTION 'Auth error: auth.uid() is %', auth.uid();
    END IF;
    IF auth.role() IS NULL OR auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Auth error: auth.role() is %', auth.role();
    END IF;
END $$;

-- Acquires Level 1 lock: shared_rides FOR UPDATE (decrements available_seats to 0)
SELECT public.accept_ride_participant('c0030000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222');
-- PAUSE: Do not commit yet. Hold Level 1 lock.
-- Instruct Terminal 2 to execute accept_ride_participant for Charlie (Terminal 2 blocks).
COMMIT;


-- =============================================================================
-- TEST-CONC-04: Ride Closure vs. New Seat Request Race
-- =============================================================================
-- Terminal 1 (Host Alice: Cancels Ride via cancel_shared_ride RPC)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '11111111-1111-1111-1111-111111111111',
    'role', 'authenticated'
)::text, true);

DO $$
BEGIN
    IF auth.uid() IS NULL OR auth.uid() != '11111111-1111-1111-1111-111111111111'::uuid THEN
        RAISE EXCEPTION 'Auth error: auth.uid() is %', auth.uid();
    END IF;
    IF auth.role() IS NULL OR auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Auth error: auth.role() is %', auth.role();
    END IF;
END $$;

-- Executes host cancellation RPC: locks shared_rides FOR UPDATE Level 1 and updates status
SELECT public.cancel_shared_ride('c0040000-0000-0000-0000-000000000004');
-- PAUSE: Holds FOR UPDATE on Level 1 ride tuple. Do not commit yet.
-- Instruct Terminal 2 to execute request_ride_seats (Terminal 2 FOR SHARE blocks).
COMMIT;


-- =============================================================================
-- TEST-CONC-05A: Cancellation vs. Acceptance (Ordering 1: Host Accept Commits First)
-- =============================================================================
-- Terminal 1 (Host Alice: Accepts Bob - Commits First)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '11111111-1111-1111-1111-111111111111',
    'role', 'authenticated'
)::text, true);

DO $$
BEGIN
    IF auth.uid() IS NULL OR auth.uid() != '11111111-1111-1111-1111-111111111111'::uuid THEN
        RAISE EXCEPTION 'Auth error: auth.uid() is %', auth.uid();
    END IF;
    IF auth.role() IS NULL OR auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Auth error: auth.role() is %', auth.role();
    END IF;
END $$;

-- Acquires Level 1 lock (shared_rides FOR UPDATE) & Level 2 lock (ride_participants FOR UPDATE)
SELECT public.accept_ride_participant('c0051000-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222');
-- PAUSE: Instruct Terminal 2 to execute cancel_ride_reservation (Terminal 2 blocks on Level 1).
COMMIT; -- Decrements available_seats from 2 to 1 and commits acceptance


-- =============================================================================
-- TEST-CONC-05B: Cancellation vs. Acceptance (Ordering 2: Rider Cancel Commits First)
-- =============================================================================
-- In this ordering, Terminal 1 waits while Terminal 2 executes first!
-- When instructed by Terminal 2 (which holds Level 1 lock), run:
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '11111111-1111-1111-1111-111111111111',
    'role', 'authenticated'
)::text, true);

-- Attempts Level 1 lock (shared_rides FOR UPDATE). Blocks immediately until Terminal 2 commits.
DO $$
DECLARE
    v_succeeded BOOLEAN := false;
    v_sqlstate TEXT;
    v_sqlerrm TEXT;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() != '11111111-1111-1111-1111-111111111111'::uuid THEN
        RAISE EXCEPTION 'Auth error: auth.uid() is %', auth.uid();
    END IF;
    IF auth.role() IS NULL OR auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Auth error: auth.role() is %', auth.role();
    END IF;

    BEGIN
        PERFORM public.accept_ride_participant('c0052000-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222');
        v_succeeded := true;
    EXCEPTION WHEN raise_exception THEN
        v_sqlstate := SQLSTATE;
        v_sqlerrm := SQLERRM;
    END;

    IF v_succeeded THEN
        RAISE EXCEPTION 'TEST-CONC-05B FAILED: Host accept succeeded on cancelled reservation!';
    END IF;

    IF v_sqlstate != 'P0001' OR v_sqlerrm NOT LIKE '%Cannot accept request in status: cancelled%' THEN
        RAISE EXCEPTION 'TEST-CONC-05B FAILED: Unexpected error condition (SQLSTATE: %, Message: %)', v_sqlstate, v_sqlerrm;
    END IF;

    RAISE NOTICE 'TEST-CONC-05B PASSED: Host accept rejected after rider cancellation (SQLSTATE: %, Message: %)', v_sqlstate, v_sqlerrm;
END $$;
ROLLBACK;


-- =============================================================================
-- TEST-CONC-06: Host Decline vs. Acceptance Race
-- =============================================================================
-- Terminal 1 (Host Alice: Declines Bob)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '11111111-1111-1111-1111-111111111111',
    'role', 'authenticated'
)::text, true);

DO $$
BEGIN
    IF auth.uid() IS NULL OR auth.uid() != '11111111-1111-1111-1111-111111111111'::uuid THEN
        RAISE EXCEPTION 'Auth error: auth.uid() is %', auth.uid();
    END IF;
    IF auth.role() IS NULL OR auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Auth error: auth.role() is %', auth.role();
    END IF;
END $$;

SELECT public.decline_ride_participant('c0060000-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222');
-- PAUSE: Holds Level 1 & Level 2 locks. Instruct Terminal 2 to attempt acceptance (Terminal 2 blocks).
COMMIT;


-- =============================================================================
-- TEST-CONC-07: Cart Closure vs. Concurrent Item Insertion Race
-- =============================================================================
-- Terminal 1 (Host Alice: Locks Cart)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '11111111-1111-1111-1111-111111111111',
    'role', 'authenticated'
)::text, true);

DO $$
BEGIN
    IF auth.uid() IS NULL OR auth.uid() != '11111111-1111-1111-1111-111111111111'::uuid THEN
        RAISE EXCEPTION 'Auth error: auth.uid() is %', auth.uid();
    END IF;
    IF auth.role() IS NULL OR auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Auth error: auth.role() is %', auth.role();
    END IF;
END $$;

UPDATE public.group_carts 
SET status = 'locked'::group_cart_status 
WHERE id = 'c0070000-0000-0000-0000-000000000007';
-- PAUSE: Holds FOR NO KEY UPDATE on parent cart tuple. Do not commit yet.
-- Instruct Terminal 2 to attempt INSERT into cart_items (Terminal 2 trigger FOR SHARE blocks).
COMMIT;
```

---

## File 6 of 6: `supabase/tests/concurrency_session_2.sql`

> **File:** `supabase/tests/concurrency_session_2.sql`  
> **Lines:** 532  
> **Bytes:** 22178  
> **SHA-256:** `9500f2d0945271f4a28aff7c8c6d7d4d01017faee3cd480e296c888db41cff5c`  
> **Encoding:** UTF-8  

```sql
-- =============================================================================
-- YUVNIX MULTI-SESSION CONCURRENCY TEST SUITE: SESSION 2
-- Target: Local Supabase PostgreSQL 15 Disposable Test Environment
-- Execution: Run in Terminal Window 2 step-by-step
-- Coordinate with supabase/tests/concurrency_session_1.sql in Terminal Window 1
-- =============================================================================

\set ON_ERROR_STOP on

-- =============================================================================
-- TEST-CONC-01: Two Different Students Requesting Same Ride Concurrently
-- =============================================================================
-- Terminal 2 (Student C: Charlie)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '44444444-4444-4444-4444-444444444444';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '44444444-4444-4444-4444-444444444444',
    'role', 'authenticated'
)::text, true);

DO $$
BEGIN
    IF auth.uid() IS NULL OR auth.uid() != '44444444-4444-4444-4444-444444444444'::uuid THEN
        RAISE EXCEPTION 'Auth error: auth.uid() is %', auth.uid();
    END IF;
    IF auth.role() IS NULL OR auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Auth error: auth.role() is %', auth.role();
    END IF;
END $$;

SELECT public.request_ride_seats('c0010000-0000-0000-0000-000000000001', 1);
-- EXPECTED: Executes concurrently without blocking. UNIQUE(ride_id, user_id) does not collide.
COMMIT;

-- POST-TEST PROGRAMMATIC STATE ASSERTIONS:
DO $$
DECLARE
    v_part_count INT;
    v_seats INT;
    v_status shared_ride_status;
BEGIN
    SELECT count(*) INTO v_part_count 
    FROM public.ride_participants 
    WHERE ride_id = 'c0010000-0000-0000-0000-000000000001' AND status = 'pending'::ride_participant_status;

    SELECT available_seats, status INTO v_seats, v_status 
    FROM public.shared_rides 
    WHERE id = 'c0010000-0000-0000-0000-000000000001';

    IF v_part_count != 2 THEN
        RAISE EXCEPTION 'ASSERTION FAILED TEST-CONC-01: Expected 2 pending participants, found %', v_part_count;
    END IF;
    IF v_seats != 2 OR v_status != 'open'::shared_ride_status THEN
        RAISE EXCEPTION 'ASSERTION FAILED TEST-CONC-01: Expected available_seats=2, status=open, found % / %', v_seats, v_status;
    END IF;

    RAISE NOTICE 'TEST-CONC-01 STATE VERIFIED: 2 pending participants registered concurrently, ride status open.';
END $$;


-- =============================================================================
-- TEST-CONC-02: Same Student Rapid Double Request (Unique Constraint Collision)
-- =============================================================================
-- Terminal 2 (Student B: Bob, Tab 2 - Rapid Duplicate Request)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '22222222-2222-2222-2222-222222222222',
    'role', 'authenticated'
)::text, true);

-- Run while Terminal 1 transaction is active:
-- EXPECTED BEHAVIOR: BLOCKS on UNIQUE (ride_id, user_id) tuple lock held by Terminal 1.
-- ONCE Terminal 1 COMMITS: Unblocks, detects existing pending request, raises custom exception P0001.
DO $$
DECLARE
    v_succeeded BOOLEAN := false;
    v_sqlstate TEXT;
    v_sqlerrm TEXT;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() != '22222222-2222-2222-2222-222222222222'::uuid THEN
        RAISE EXCEPTION 'Auth error: auth.uid() is %', auth.uid();
    END IF;
    IF auth.role() IS NULL OR auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Auth error: auth.role() is %', auth.role();
    END IF;

    BEGIN
        PERFORM public.request_ride_seats('c0020000-0000-0000-0000-000000000002', 1);
        v_succeeded := true;
    EXCEPTION WHEN raise_exception THEN
        v_sqlstate := SQLSTATE;
        v_sqlerrm := SQLERRM;
    END;

    IF v_succeeded THEN
        RAISE EXCEPTION 'TEST-CONC-02 FAILED: Duplicate ride request succeeded!';
    END IF;

    IF v_sqlstate != 'P0001' OR v_sqlerrm NOT LIKE '%already active%' THEN
        RAISE EXCEPTION 'TEST-CONC-02 FAILED: Unexpected error condition (SQLSTATE: %, Message: %)', v_sqlstate, v_sqlerrm;
    END IF;

    RAISE NOTICE 'TEST-CONC-02 PASSED: Rapid duplicate request blocked after unblock (SQLSTATE: %, Message: %)', v_sqlstate, v_sqlerrm;
END $$;
ROLLBACK;

-- POST-TEST PROGRAMMATIC STATE ASSERTIONS:
DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT count(*) INTO v_count 
    FROM public.ride_participants 
    WHERE ride_id = 'c0020000-0000-0000-0000-000000000002' AND user_id = '22222222-2222-2222-2222-222222222222';

    IF v_count != 1 THEN
        RAISE EXCEPTION 'ASSERTION FAILED TEST-CONC-02: Expected exactly 1 participant row, found %', v_count;
    END IF;

    RAISE NOTICE 'TEST-CONC-02 STATE VERIFIED: Exactly 1 reservation exists; duplicate was rejected.';
END $$;


-- =============================================================================
-- TEST-CONC-03: Two Host Sessions Accepting Final Available Seat
-- =============================================================================
-- Terminal 2 (Host Alice: Accepts Charlie in Tab 2)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '11111111-1111-1111-1111-111111111111',
    'role', 'authenticated'
)::text, true);

-- Run while Terminal 1 transaction is active:
-- EXPECTED BEHAVIOR: BLOCKS on Level 1 lock (shared_rides FOR UPDATE) held by Terminal 1.
-- ONCE Terminal 1 COMMITS: Unblocks, re-reads available_seats = 0, detects 0 < 1, and raises P0001.
DO $$
DECLARE
    v_succeeded BOOLEAN := false;
    v_sqlstate TEXT;
    v_sqlerrm TEXT;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() != '11111111-1111-1111-1111-111111111111'::uuid THEN
        RAISE EXCEPTION 'Auth error: auth.uid() is %', auth.uid();
    END IF;
    IF auth.role() IS NULL OR auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Auth error: auth.role() is %', auth.role();
    END IF;

    BEGIN
        PERFORM public.accept_ride_participant('c0030000-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444');
        v_succeeded := true;
    EXCEPTION WHEN raise_exception THEN
        v_sqlstate := SQLSTATE;
        v_sqlerrm := SQLERRM;
    END;

    IF v_succeeded THEN
        RAISE EXCEPTION 'TEST-CONC-03 FAILED: Host accept succeeded when 0 seats were available!';
    END IF;

    IF v_sqlstate != 'P0001' OR v_sqlerrm NOT LIKE '%Available seats (0) less than requested%' THEN
        RAISE EXCEPTION 'TEST-CONC-03 FAILED: Unexpected error condition (SQLSTATE: %, Message: %)', v_sqlstate, v_sqlerrm;
    END IF;

    RAISE NOTICE 'TEST-CONC-03 PASSED: Concurrent seat oversubscription rejected (SQLSTATE: %, Message: %)', v_sqlstate, v_sqlerrm;
END $$;
ROLLBACK;

-- POST-TEST PROGRAMMATIC STATE ASSERTIONS:
DO $$
DECLARE
    v_bob_status ride_participant_status;
    v_charlie_status ride_participant_status;
    v_seats INT;
    v_status shared_ride_status;
BEGIN
    SELECT status INTO v_bob_status FROM public.ride_participants 
    WHERE ride_id = 'c0030000-0000-0000-0000-000000000003' AND user_id = '22222222-2222-2222-2222-222222222222';

    SELECT status INTO v_charlie_status FROM public.ride_participants 
    WHERE ride_id = 'c0030000-0000-0000-0000-000000000003' AND user_id = '44444444-4444-4444-4444-444444444444';

    SELECT available_seats, status INTO v_seats, v_status 
    FROM public.shared_rides 
    WHERE id = 'c0030000-0000-0000-0000-000000000003';

    IF v_bob_status != 'accepted'::ride_participant_status THEN
        RAISE EXCEPTION 'ASSERTION FAILED TEST-CONC-03: Expected Bob accepted, found %', v_bob_status;
    END IF;
    IF v_charlie_status != 'pending'::ride_participant_status THEN
        RAISE EXCEPTION 'ASSERTION FAILED TEST-CONC-03: Expected Charlie pending, found %', v_charlie_status;
    END IF;
    IF v_seats != 0 OR v_status != 'full'::shared_ride_status THEN
        RAISE EXCEPTION 'ASSERTION FAILED TEST-CONC-03: Expected available_seats=0, status=full, found % / %', v_seats, v_status;
    END IF;

    RAISE NOTICE 'TEST-CONC-03 STATE VERIFIED: Bob accepted, Charlie pending, ride full (0 available seats).';
END $$;


-- =============================================================================
-- TEST-CONC-04: Ride Closure vs. New Seat Request Race
-- =============================================================================
-- Terminal 2 (Student Charlie: Attempts Request)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '44444444-4444-4444-4444-444444444444';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '44444444-4444-4444-4444-444444444444',
    'role', 'authenticated'
)::text, true);

-- Run while Terminal 1 holds UPDATE lock on ride:
-- EXPECTED BEHAVIOR: BLOCKS because FOR SHARE conflicts with FOR UPDATE on Level 1.
-- ONCE Terminal 1 COMMITS status = 'cancelled': Unblocks, re-reads committed status = 'cancelled', and raises P0001.
DO $$
DECLARE
    v_succeeded BOOLEAN := false;
    v_sqlstate TEXT;
    v_sqlerrm TEXT;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() != '44444444-4444-4444-4444-444444444444'::uuid THEN
        RAISE EXCEPTION 'Auth error: auth.uid() is %', auth.uid();
    END IF;
    IF auth.role() IS NULL OR auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Auth error: auth.role() is %', auth.role();
    END IF;

    BEGIN
        PERFORM public.request_ride_seats('c0040000-0000-0000-0000-000000000004', 1);
        v_succeeded := true;
    EXCEPTION WHEN raise_exception THEN
        v_sqlstate := SQLSTATE;
        v_sqlerrm := SQLERRM;
    END;

    IF v_succeeded THEN
        RAISE EXCEPTION 'TEST-CONC-04 FAILED: Seat request registered on cancelled ride!';
    END IF;

    IF v_sqlstate != 'P0001' OR v_sqlerrm NOT LIKE '%no longer accepting reservation requests%' THEN
        RAISE EXCEPTION 'TEST-CONC-04 FAILED: Unexpected error condition (SQLSTATE: %, Message: %)', v_sqlstate, v_sqlerrm;
    END IF;

    RAISE NOTICE 'TEST-CONC-04 PASSED: Seat request rejected after concurrent ride cancellation (SQLSTATE: %, Message: %)', v_sqlstate, v_sqlerrm;
END $$;
ROLLBACK;

-- POST-TEST PROGRAMMATIC STATE ASSERTIONS:
DO $$
DECLARE
    v_status shared_ride_status;
    v_count INT;
BEGIN
    SELECT status INTO v_status FROM public.shared_rides WHERE id = 'c0040000-0000-0000-0000-000000000004';
    SELECT count(*) INTO v_count FROM public.ride_participants WHERE ride_id = 'c0040000-0000-0000-0000-000000000004';

    IF v_status != 'cancelled'::shared_ride_status THEN
        RAISE EXCEPTION 'ASSERTION FAILED TEST-CONC-04: Expected status=cancelled, found %', v_status;
    END IF;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'ASSERTION FAILED TEST-CONC-04: Expected 0 participants, found %', v_count;
    END IF;

    RAISE NOTICE 'TEST-CONC-04 STATE VERIFIED: Ride status cancelled, 0 participants registered.';
END $$;


-- =============================================================================
-- TEST-CONC-05A: Cancellation vs. Acceptance (Ordering 1: Host Accept Commits First)
-- =============================================================================
-- Terminal 2 (Rider Bob: Attempts Cancellation while Host Accept is in flight)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '22222222-2222-2222-2222-222222222222',
    'role', 'authenticated'
)::text, true);

DO $$
BEGIN
    IF auth.uid() IS NULL OR auth.uid() != '22222222-2222-2222-2222-222222222222'::uuid THEN
        RAISE EXCEPTION 'Auth error: auth.uid() is %', auth.uid();
    END IF;
    IF auth.role() IS NULL OR auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Auth error: auth.role() is %', auth.role();
    END IF;
END $$;

-- Run while Terminal 1 holds Level 1 lock:
-- EXPECTED BEHAVIOR: BLOCKS on Level 1 lock (shared_rides FOR UPDATE).
-- ONCE Terminal 1 COMMITS:
-- Unblocks, acquires Level 1 lock, reads available_seats = 1.
-- Acquires Level 2 lock, reads committed status = 'accepted'.
-- Transitions status to 'cancelled', restores 1 seat (1 -> 2).
SELECT public.cancel_ride_reservation('c0051000-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222');
COMMIT;

-- POST-TEST PROGRAMMATIC STATE ASSERTIONS:
DO $$
DECLARE
    v_status ride_participant_status;
    v_seats INT;
    v_ride_status shared_ride_status;
BEGIN
    SELECT status INTO v_status FROM public.ride_participants 
    WHERE ride_id = 'c0051000-0000-0000-0000-000000000005' AND user_id = '22222222-2222-2222-2222-222222222222';

    SELECT available_seats, status INTO v_seats, v_ride_status 
    FROM public.shared_rides 
    WHERE id = 'c0051000-0000-0000-0000-000000000005';

    IF v_status != 'cancelled'::ride_participant_status THEN
        RAISE EXCEPTION 'ASSERTION FAILED TEST-CONC-05A: Expected status=cancelled, found %', v_status;
    END IF;
    IF v_seats != 2 OR v_ride_status != 'open'::shared_ride_status THEN
        RAISE EXCEPTION 'ASSERTION FAILED TEST-CONC-05A: Expected available_seats=2, status=open, found % / %', v_seats, v_ride_status;
    END IF;

    RAISE NOTICE 'TEST-CONC-05A STATE VERIFIED: Participant cancelled, exactly 1 seat restored (available_seats=2, status=open).';
END $$;


-- =============================================================================
-- TEST-CONC-05B: Cancellation vs. Acceptance (Ordering 2: Rider Cancel Commits First)
-- =============================================================================
-- In this ordering, Terminal 2 executes FIRST:
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '22222222-2222-2222-2222-222222222222',
    'role', 'authenticated'
)::text, true);

DO $$
BEGIN
    IF auth.uid() IS NULL OR auth.uid() != '22222222-2222-2222-2222-222222222222'::uuid THEN
        RAISE EXCEPTION 'Auth error: auth.uid() is %', auth.uid();
    END IF;
    IF auth.role() IS NULL OR auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Auth error: auth.role() is %', auth.role();
    END IF;
END $$;

-- Acquires Level 1 lock (shared_rides FOR UPDATE) & Level 2 lock:
SELECT public.cancel_ride_reservation('c0052000-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222');
-- PAUSE: Terminal 2 holds locks. Instruct Terminal 1 to execute accept_ride_participant (Terminal 1 blocks).
COMMIT; -- Terminal 2 commits first! Status is cancelled, 0 seats restored (was pending).

-- POST-TEST PROGRAMMATIC STATE ASSERTIONS:
DO $$
DECLARE
    v_status ride_participant_status;
    v_seats INT;
    v_ride_status shared_ride_status;
BEGIN
    SELECT status INTO v_status FROM public.ride_participants 
    WHERE ride_id = 'c0052000-0000-0000-0000-000000000005' AND user_id = '22222222-2222-2222-2222-222222222222';

    SELECT available_seats, status INTO v_seats, v_ride_status 
    FROM public.shared_rides 
    WHERE id = 'c0052000-0000-0000-0000-000000000005';

    IF v_status != 'cancelled'::ride_participant_status THEN
        RAISE EXCEPTION 'ASSERTION FAILED TEST-CONC-05B: Expected status=cancelled, found %', v_status;
    END IF;
    IF v_seats != 2 OR v_ride_status != 'open'::shared_ride_status THEN
        RAISE EXCEPTION 'ASSERTION FAILED TEST-CONC-05B: Expected available_seats=2, status=open, found % / %', v_seats, v_ride_status;
    END IF;

    RAISE NOTICE 'TEST-CONC-05B STATE VERIFIED: Participant cancelled while pending (available_seats=2, status=open).';
END $$;


-- =============================================================================
-- TEST-CONC-06: Host Decline vs. Acceptance Race
-- =============================================================================
-- Terminal 2 (Host Alice: Accepts Bob in Tab 2)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '11111111-1111-1111-1111-111111111111',
    'role', 'authenticated'
)::text, true);

-- Run while Terminal 1 transaction is active:
-- EXPECTED BEHAVIOR: BLOCKS on Level 1 lock.
-- ONCE Terminal 1 COMMITS decline: Unblocks, reads status = 'declined', and raises P0001.
DO $$
DECLARE
    v_succeeded BOOLEAN := false;
    v_sqlstate TEXT;
    v_sqlerrm TEXT;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() != '11111111-1111-1111-1111-111111111111'::uuid THEN
        RAISE EXCEPTION 'Auth error: auth.uid() is %', auth.uid();
    END IF;
    IF auth.role() IS NULL OR auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Auth error: auth.role() is %', auth.role();
    END IF;

    BEGIN
        PERFORM public.accept_ride_participant('c0060000-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222');
        v_succeeded := true;
    EXCEPTION WHEN raise_exception THEN
        v_sqlstate := SQLSTATE;
        v_sqlerrm := SQLERRM;
    END;

    IF v_succeeded THEN
        RAISE EXCEPTION 'TEST-CONC-06 FAILED: Host accept succeeded on declined reservation!';
    END IF;

    IF v_sqlstate != 'P0001' OR v_sqlerrm NOT LIKE '%Cannot accept request in status: declined%' THEN
        RAISE EXCEPTION 'TEST-CONC-06 FAILED: Unexpected error condition (SQLSTATE: %, Message: %)', v_sqlstate, v_sqlerrm;
    END IF;

    RAISE NOTICE 'TEST-CONC-06 PASSED: Host accept rejected after decline (SQLSTATE: %, Message: %)', v_sqlstate, v_sqlerrm;
END $$;
ROLLBACK;

-- POST-TEST PROGRAMMATIC STATE ASSERTIONS:
DO $$
DECLARE
    v_status ride_participant_status;
    v_seats INT;
    v_ride_status shared_ride_status;
BEGIN
    SELECT status INTO v_status FROM public.ride_participants 
    WHERE ride_id = 'c0060000-0000-0000-0000-000000000006' AND user_id = '22222222-2222-2222-2222-222222222222';

    SELECT available_seats, status INTO v_seats, v_ride_status 
    FROM public.shared_rides 
    WHERE id = 'c0060000-0000-0000-0000-000000000006';

    IF v_status != 'declined'::ride_participant_status THEN
        RAISE EXCEPTION 'ASSERTION FAILED TEST-CONC-06: Expected status=declined, found %', v_status;
    END IF;
    IF v_seats != 1 OR v_ride_status != 'open'::shared_ride_status THEN
        RAISE EXCEPTION 'ASSERTION FAILED TEST-CONC-06: Expected available_seats=1, status=open, found % / %', v_seats, v_ride_status;
    END IF;

    RAISE NOTICE 'TEST-CONC-06 STATE VERIFIED: Status declined, seat count untouched (available_seats=1, status=open).';
END $$;


-- =============================================================================
-- TEST-CONC-07: Cart Closure vs. Concurrent Item Insertion Race
-- =============================================================================
-- Terminal 2 (Alice: Attempts Concurrent Item Insertion)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', '11111111-1111-1111-1111-111111111111',
    'role', 'authenticated'
)::text, true);

-- Run while Terminal 1 holds UPDATE lock on group_carts:
-- EXPECTED BEHAVIOR: Trigger trg_enforce_cart_item_lock requests FOR SHARE on parent cart.
-- FOR SHARE conflicts with FOR NO KEY UPDATE. Terminal 2 BLOCKS on lock_wait.
-- ONCE Terminal 1 COMMITS status = 'locked':
-- Unblocks, re-reads committed status = 'locked', and raises P0001.
DO $$
DECLARE
    v_succeeded BOOLEAN := false;
    v_sqlstate TEXT;
    v_sqlerrm TEXT;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() != '11111111-1111-1111-1111-111111111111'::uuid THEN
        RAISE EXCEPTION 'Auth error: auth.uid() is %', auth.uid();
    END IF;
    IF auth.role() IS NULL OR auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Auth error: auth.role() is %', auth.role();
    END IF;

    BEGIN
        INSERT INTO public.cart_items (id, cart_id, added_by_user_id, item_name, quantity)
        VALUES ('c0070000-0000-0000-0000-000000000077', 'c0070000-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'Fresh Bread', 1);
        v_succeeded := true;
    EXCEPTION WHEN raise_exception THEN
        v_sqlstate := SQLSTATE;
        v_sqlerrm := SQLERRM;
    END;

    IF v_succeeded THEN
        RAISE EXCEPTION 'TEST-CONC-07 FAILED: Item was inserted into locked cart!';
    END IF;

    IF v_sqlstate != 'P0001' OR v_sqlerrm NOT LIKE '%Cart is locked or closed%' THEN
        RAISE EXCEPTION 'TEST-CONC-07 FAILED: Unexpected error condition (SQLSTATE: %, Message: %)', v_sqlstate, v_sqlerrm;
    END IF;

    RAISE NOTICE 'TEST-CONC-07 PASSED: Cart item insertion blocked when cart locked (SQLSTATE: %, Message: %)', v_sqlstate, v_sqlerrm;
END $$;
ROLLBACK;

-- POST-TEST PROGRAMMATIC STATE ASSERTIONS:
DO $$
DECLARE
    v_cart_status group_cart_status;
    v_item_count INT;
BEGIN
    SELECT status INTO v_cart_status FROM public.group_carts WHERE id = 'c0070000-0000-0000-0000-000000000007';
    SELECT count(*) INTO v_item_count FROM public.cart_items WHERE cart_id = 'c0070000-0000-0000-0000-000000000007';

    IF v_cart_status != 'locked'::group_cart_status THEN
        RAISE EXCEPTION 'ASSERTION FAILED TEST-CONC-07: Expected status=locked, found %', v_cart_status;
    END IF;
    IF v_item_count != 0 THEN
        RAISE EXCEPTION 'ASSERTION FAILED TEST-CONC-07: Expected 0 items, found %', v_item_count;
    END IF;

    RAISE NOTICE 'TEST-CONC-07 STATE VERIFIED: Cart is locked, item insertion was rejected (0 items exist).';
END $$;
```

---

