-- =============================================================================
-- YUVNIX MULTI-SESSION CONCURRENCY TEST SUITE: SESSION 1
-- Execution Instructions: Open Terminal Window 1 and run commands step-by-step
-- Coordinate with supabase/tests/concurrency_session_2.sql in Terminal Window 2
-- =============================================================================

-- =============================================================================
-- TEST-CONC-01: Two Different Students Requesting Same Ride Concurrently
-- =============================================================================
-- Terminal 1 (Student B)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
SELECT public.request_ride_seats('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 1);
-- PAUSE: Wait for Terminal 2 to execute its request.
COMMIT;


-- =============================================================================
-- TEST-CONC-02: Same Student Rapid Double Request (Unique Constraint Collision)
-- =============================================================================
-- Terminal 1 (Student B, Tab 1)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
SELECT public.request_ride_seats('ffffffff-ffff-ffff-ffff-ffffffffffff', 1);
-- PAUSE: Do not commit yet. Let Terminal 2 execute duplicate request.
-- Once Terminal 2 is blocked on unique index tuple lock, commit Terminal 1:
COMMIT;


-- =============================================================================
-- TEST-CONC-03: Two Host Sessions Accepting Final Available Seat
-- =============================================================================
-- Terminal 1 (Host Acceptance for Student B)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
-- Acquires Level 1 row lock: shared_rides FOR UPDATE
SELECT public.accept_ride_participant('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222');
-- PAUSE: Do not commit yet. Let Terminal 2 attempt acceptance for Student C.
-- Terminal 2 will BLOCK on shared_rides Level 1 lock.
COMMIT;


-- =============================================================================
-- TEST-CONC-04: Ride Closure vs. New Seat Request Race
-- =============================================================================
-- Terminal 1 (Host cancels ride)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
UPDATE public.shared_rides 
SET status = 'cancelled'::shared_ride_status 
WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
-- PAUSE: Holds FOR NO KEY UPDATE on Level 1 tuple. Do not commit yet.
-- Let Terminal 2 attempt request_ride_seats (requests FOR SHARE and blocks).
COMMIT;


-- =============================================================================
-- TEST-CONC-05A: Cancellation vs. Acceptance (Ordering 1: Host Accept Commits First)
-- =============================================================================
-- Terminal 1 (Host Accept - Commits First)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
-- Acquires Level 1 lock (shared_rides FOR UPDATE) & Level 2 lock (ride_participants FOR UPDATE)
SELECT public.accept_ride_participant('ffffffff-ffff-ffff-ffff-ffffffffffff', '22222222-2222-2222-2222-222222222222');
-- PAUSE: Let Terminal 2 attempt cancellation (will block on Level 1 lock).
COMMIT; -- Commit acceptance (decrements available_seats from 2 to 1)


-- =============================================================================
-- TEST-CONC-05B: Cancellation vs. Acceptance (Ordering 2: Rider Cancel Commits First)
-- =============================================================================
-- In this ordering, Terminal 1 waits while Terminal 2 executes cancellation first!
-- When instructed by Terminal 2 (which holds Level 1 lock), run:
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
-- Attempts Level 1 lock: shared_rides FOR UPDATE.
-- BLOCKS immediately until Terminal 2 commits.
SELECT public.accept_ride_participant('ffffffff-ffff-ffff-ffff-ffffffffffff', '22222222-2222-2222-2222-222222222222');
-- EXPECTED AFTER UNBLOCK: Aborts with P0001: Cannot accept request in status: cancelled
ROLLBACK;


-- =============================================================================
-- TEST-CONC-06: Host Decline vs. Acceptance Race
-- =============================================================================
-- Terminal 1 (Host declines)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SELECT public.decline_ride_participant('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222');
-- PAUSE: Let Terminal 2 attempt acceptance (will block on Level 1 lock).
COMMIT;


-- =============================================================================
-- TEST-CONC-07: Cart Closure vs. Concurrent Item Insertion Race
-- =============================================================================
-- Terminal 1 (Host locks cart)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
UPDATE public.group_carts 
SET status = 'locked'::group_cart_status 
WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
-- PAUSE: Holds FOR NO KEY UPDATE on parent cart tuple. Do not commit yet.
-- Let Terminal 2 attempt INSERT into cart_items (blocks on trigger FOR SHARE lock).
COMMIT;
