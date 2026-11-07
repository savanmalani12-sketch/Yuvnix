-- =============================================================================
-- YUVNIX SQL SECURITY TEST FIXTURES TEARDOWN
-- Target: Local Supabase PostgreSQL 15 Disposable Test Environment
-- Execution: psql -h localhost -p 54322 -U postgres -d postgres -f supabase/tests/cleanup.sql
-- =============================================================================

BEGIN;

-- 1. Remove temporary test records
DELETE FROM public.cart_items WHERE id = '99999999-9999-9999-9999-999999999991';
DELETE FROM public.notifications WHERE id = '99999999-9999-9999-9999-999999999999';
DELETE FROM public.communities WHERE slug IN ('staff-created-comm-test', 'staff-created-community');

-- 2. Remove fixture community requests
DELETE FROM public.community_requests WHERE id = '77777777-7777-7777-7777-777777777777';

-- 3. Remove fixture rides (cascades to ride_participants & ride_messages)
DELETE FROM public.shared_rides WHERE id IN (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'ffffffff-ffff-ffff-ffff-ffffffffffff'
);

-- 4. Remove fixture carts (cascades to cart_participants, cart_items, & cart_messages)
DELETE FROM public.group_carts WHERE id IN (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'dddddddd-dddd-dddd-dddd-dddddddddddd'
);

-- 5. Remove fixture communities (cascades to pickup points, memberships)
DELETE FROM public.communities WHERE id IN (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
);

-- 6. Remove fixture profiles & private profiles
DELETE FROM public.profiles WHERE id IN (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '44444444-4444-4444-4444-444444444444',
    '33333333-3333-3333-3333-333333333333'
);

COMMIT;

SELECT 'All Yuvnix test fixtures successfully cleaned up.' AS status;
