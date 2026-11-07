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
