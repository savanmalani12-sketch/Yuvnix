-- =============================================================================
-- YUVNIX MULTI-SESSION CONCURRENCY TEST SUITE: SESSION 2
-- Execution Instructions: Open Terminal Window 2 and run commands step-by-step
-- Coordinate with supabase/tests/concurrency_session_1.sql in Terminal Window 1
-- =============================================================================

-- =============================================================================
-- TEST-CONC-01: Two Different Students Requesting Same Ride Concurrently
-- =============================================================================
-- Terminal 2 (Student C: Charlie)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '44444444-4444-4444-4444-444444444444';
SELECT public.request_ride_seats('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 1);
-- EXPECTED: Executes concurrently without blocking. UNIQUE(ride_id, user_id) does not collide.
COMMIT;
-- VERIFICATION:
-- Both Alice (host), Bob (rider B), and Charlie (rider C) have valid records.
-- SELECT user_id, status FROM public.ride_participants WHERE ride_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';


-- =============================================================================
-- TEST-CONC-02: Same Student Rapid Double Request (Unique Constraint Collision)
-- =============================================================================
-- Terminal 2 (Student B, Tab 2 - Rapid Duplicate Request)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
-- Run while Terminal 1 transaction is active:
SELECT public.request_ride_seats('ffffffff-ffff-ffff-ffff-ffffffffffff', 1);
-- EXPECTED BEHAVIOR: BLOCKS on UNIQUE (ride_id, user_id) tuple lock held by Terminal 1.
-- ONCE Terminal 1 COMMITS:
-- Unblocks, detects existing pending request, raises custom exception:
-- ERROR: A pending seat request is already active for this ride. (SQLSTATE: P0001)
ROLLBACK;


-- =============================================================================
-- TEST-CONC-03: Two Host Sessions Accepting Final Available Seat
-- =============================================================================
-- Terminal 2 (Host Acceptance for Student C)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
-- Run while Terminal 1 transaction is active:
SELECT public.accept_ride_participant('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '44444444-4444-4444-4444-444444444444');
-- EXPECTED BEHAVIOR: BLOCKS on Level 1 lock (shared_rides FOR UPDATE) held by Terminal 1.
-- ONCE Terminal 1 COMMITS:
-- Unblocks, re-reads available_seats = 0, detects 0 < 1, and raises:
-- ERROR: Cannot accept: Available seats (0) less than requested (1). (SQLSTATE: P0001)
ROLLBACK;


-- =============================================================================
-- TEST-CONC-04: Ride Closure vs. New Seat Request Race
-- =============================================================================
-- Terminal 2 (Student C requests seats)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '44444444-4444-4444-4444-444444444444';
-- Run while Terminal 1 transaction holds UPDATE lock on ride:
SELECT public.request_ride_seats('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 1);
-- EXPECTED BEHAVIOR: BLOCKS because FOR SHARE conflicts with FOR NO KEY UPDATE on Level 1.
-- ONCE Terminal 1 COMMITS status = 'cancelled':
-- Unblocks, re-reads committed status = 'cancelled', and raises:
-- ERROR: Ride is no longer accepting reservation requests. (SQLSTATE: P0001)
ROLLBACK;


-- =============================================================================
-- TEST-CONC-05A: Cancellation vs. Acceptance (Ordering 1: Host Accept Commits First)
-- =============================================================================
-- Terminal 2 (Rider Cancellation - Attempts while Host Accept is in flight)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
-- Run while Terminal 1 holds Level 1 lock:
SELECT public.cancel_ride_reservation('ffffffff-ffff-ffff-ffff-ffffffffffff', '22222222-2222-2222-2222-222222222222');
-- EXPECTED BEHAVIOR: BLOCKS on Level 1 lock (shared_rides FOR UPDATE).
-- ONCE Terminal 1 COMMITS:
-- Unblocks, acquires Level 1 lock, reads available_seats = 1.
-- Acquires Level 2 lock, reads committed status = 'accepted'.
-- Transitions status to 'cancelled', restores 1 seat (1 -> 2).
COMMIT;
-- VERIFICATION:
-- SELECT available_seats FROM public.shared_rides WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'; -- Returns 2


-- =============================================================================
-- TEST-CONC-05B: Cancellation vs. Acceptance (Ordering 2: Rider Cancel Commits First)
-- =============================================================================
-- In this ordering, Terminal 2 executes FIRST:
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
-- Acquires Level 1 lock (shared_rides FOR UPDATE) & Level 2 lock:
SELECT public.cancel_ride_reservation('ffffffff-ffff-ffff-ffff-ffffffffffff', '22222222-2222-2222-2222-222222222222');
-- PAUSE: Terminal 2 holds locks. Instruct Terminal 1 to execute accept_ride_participant (Terminal 1 blocks).
COMMIT; -- Terminal 2 commits first! Status is cancelled, 0 seats restored (was pending).
-- ONCE Terminal 2 COMMITS:
-- Terminal 1 unblocks, detects status = 'cancelled' != 'pending', and raises P0001.


-- =============================================================================
-- TEST-CONC-06: Host Decline vs. Acceptance Race
-- =============================================================================
-- Terminal 2 (Host Accept in Tab 2)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
-- Run while Terminal 1 transaction is active:
SELECT public.accept_ride_participant('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222');
-- EXPECTED BEHAVIOR: BLOCKS on Level 1 lock.
-- ONCE Terminal 1 COMMITS decline:
-- Unblocks, reads status = 'declined', and raises:
-- ERROR: Cannot accept request in status: declined (must be pending). (SQLSTATE: P0001)
ROLLBACK;


-- =============================================================================
-- TEST-CONC-07: Cart Closure vs. Concurrent Item Insertion Race
-- =============================================================================
-- Terminal 2 (Student attempts item insertion)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
-- Run while Terminal 1 holds UPDATE lock on group_carts:
INSERT INTO public.cart_items (id, cart_id, added_by_user_id, item_name, quantity)
VALUES ('99999999-9999-9999-9999-999999999991', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Fresh Bread', 1);
-- EXPECTED BEHAVIOR: Trigger trg_enforce_cart_item_lock requests FOR SHARE on parent cart.
-- FOR SHARE conflicts with FOR NO KEY UPDATE. Terminal 2 BLOCKS on lock_wait.
-- ONCE Terminal 1 COMMITS status = 'locked':
-- Unblocks, re-reads committed status = 'locked', and raises:
-- ERROR: Cart is locked or closed. Items cannot be added, edited, or deleted. (SQLSTATE: P0001)
ROLLBACK;

-- POST-TEST VERIFICATION QUERY:
-- SELECT count(*) FROM public.cart_items WHERE id = '99999999-9999-9999-9999-999999999991';
-- EXPECTED: Returns 0 (Item was never inserted).
