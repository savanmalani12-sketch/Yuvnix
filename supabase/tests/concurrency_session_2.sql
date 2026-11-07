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
