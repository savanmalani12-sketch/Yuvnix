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

