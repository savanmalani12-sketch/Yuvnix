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
