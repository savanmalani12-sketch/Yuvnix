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
