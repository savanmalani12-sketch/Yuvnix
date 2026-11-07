-- =============================================================================
-- YUVNIX SQL SECURITY TEST FIXTURES
-- Target: Local Supabase PostgreSQL 15 Disposable Test Environment
-- Execution Role: postgres (superuser / database administrator)
-- =============================================================================

BEGIN;

-- 1. Profiles & Private Profiles
INSERT INTO public.profiles (id, full_name, role) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Alice Student', 'student'),
    ('22222222-2222-2222-2222-222222222222', 'Bob Student', 'student'),
    ('44444444-4444-4444-4444-444444444444', 'Charlie Student', 'student'),
    ('33333333-3333-3333-3333-333333333333', 'Carol Staff', 'support_staff')
ON CONFLICT (id) DO UPDATE
SET full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;

INSERT INTO public.profile_private (id, email, phone_number) VALUES
    ('11111111-1111-1111-1111-111111111111', 'alice@test.yuvnix.in', '+919876543210'),
    ('22222222-2222-2222-2222-222222222222', 'bob@test.yuvnix.in', '+919876543211'),
    ('44444444-4444-4444-4444-444444444444', 'charlie@test.yuvnix.in', '+919876543213'),
    ('33333333-3333-3333-3333-333333333333', 'carol@staff.yuvnix.in', '+919876543212')
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    phone_number = EXCLUDED.phone_number;

-- 2. Communities & Pickup Points
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

-- 3. Community Memberships
-- Alice is member of PDEU Hostel; Bob is member of Sunrise PG. Alice is NOT in Sunrise PG.
INSERT INTO public.community_memberships (community_id, user_id, is_active) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', true),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', true)
ON CONFLICT (community_id, user_id) DO UPDATE
SET is_active = EXCLUDED.is_active;

-- 4. Group Grocery Carts
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

-- 5. Shared Rides
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

-- 6. Pending Community Request
INSERT INTO public.community_requests (id, requested_by_user_id, proposed_name, proposed_type, proposed_address, proposed_delivery_pickup_point, proposed_taxi_pickup_point, status)
VALUES ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', 'Proposed Hostel', 'hostel', 'Sector 7', 'Main Gate', 'Main Gate', 'pending')
ON CONFLICT (id) DO UPDATE
SET status = 'pending',
    reviewed_by_staff_id = NULL;

COMMIT;

SELECT 'Test fixtures successfully provisioned.' AS status;
