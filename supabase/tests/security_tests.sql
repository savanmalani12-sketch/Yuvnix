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
