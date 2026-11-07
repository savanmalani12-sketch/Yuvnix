-- =============================================================================
-- YUVNIX SQL SECURITY CONTROL TEST SUITE (TEST-SEC-01 TO TEST-SEC-10B)
-- Target: Local Supabase PostgreSQL 15 Disposable Test Environment
-- Execution: psql -h localhost -p 54322 -U postgres -d postgres -f supabase/tests/security_tests.sql
-- =============================================================================

\set ON_ERROR_STOP on

-- TEST-SEC-01: Student Role Escalation
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

DO $$
DECLARE
    v_succeeded BOOLEAN := false;
    v_sqlstate TEXT;
BEGIN
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

-- TEST-SEC-02: Community Pickup-Point Privacy (Positive & Negative Controls)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

DO $$
DECLARE
    v_delivery TEXT;
    v_taxi TEXT;
    v_unauthorized_count INT;
BEGIN
    -- 1. Positive Control: Active member must retrieve their community pickup point
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

    -- 2. Negative Control: Non-member must receive 0 rows
    SELECT count(*) INTO v_unauthorized_count 
    FROM public.community_pickup_points 
    WHERE community_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

    IF v_unauthorized_count > 0 THEN
        RAISE EXCEPTION 'TEST-SEC-02 FAILED: Negative control breached; non-member read % rows from unjoined community!', v_unauthorized_count;
    END IF;

    RAISE NOTICE 'TEST-SEC-02 PASSED: Positive control matched exact fixture; negative control returned 0 rows.';
END $$;
ROLLBACK;

-- TEST-SEC-03: Cart Chat Access Isolation
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222'; -- Bob (not in Alice's cart)

DO $$
DECLARE
    v_succeeded BOOLEAN := false;
    v_sqlstate TEXT;
BEGIN
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

-- TEST-SEC-04: Ride Chat Access Isolation
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222'; -- Bob (status is pending)

DO $$
DECLARE
    v_succeeded BOOLEAN := false;
    v_count INT;
    v_sqlstate TEXT;
BEGIN
    SELECT count(*) INTO v_count 
    FROM public.ride_messages 
    WHERE ride_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

    IF v_count > 0 THEN
        RAISE EXCEPTION 'TEST-SEC-04 FAILED: Pending rider was able to read ride messages!';
    END IF;

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

-- TEST-SEC-05: Direct Mutations on ride_participants
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';

DO $$
DECLARE
    v_insert_ok BOOLEAN := false;
    v_update_ok BOOLEAN := false;
    v_delete_ok BOOLEAN := false;
BEGIN
    BEGIN
        INSERT INTO public.ride_participants (ride_id, user_id, seats_reserved, status)
        VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '22222222-2222-2222-2222-222222222222', 1, 'accepted');
        v_insert_ok := true;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;

    BEGIN
        UPDATE public.ride_participants 
        SET status = 'accepted'::ride_participant_status 
        WHERE ride_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' AND user_id = '22222222-2222-2222-2222-222222222222';
        v_update_ok := true;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;

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

-- TEST-SEC-06: Cart Item cart_id Foreign Key Tampering
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

DO $$
DECLARE
    v_succeeded BOOLEAN := false;
    v_sqlstate TEXT;
BEGIN
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

-- TEST-SEC-07: Cart Item added_by_user_id Tampering
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

DO $$
DECLARE
    v_succeeded BOOLEAN := false;
    v_sqlstate TEXT;
BEGIN
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

-- TEST-SEC-08: Notification Forgery
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

DO $$
DECLARE
    v_succeeded BOOLEAN := false;
    v_sqlstate TEXT;
BEGIN
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

-- TEST-SEC-09: Notification Title and Body Modification
BEGIN;
SET ROLE postgres;
INSERT INTO public.notifications (id, user_id, type, title, body)
VALUES ('99999999-9999-9999-9999-999999999999', '11111111-1111-1111-1111-111111111111', 'cart_lock_imminent', 'Test Alert', 'Original Content')
ON CONFLICT (id) DO NOTHING;

SET ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

DO $$
DECLARE
    v_succeeded BOOLEAN := false;
    v_sqlstate TEXT;
BEGIN
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

-- TEST-SEC-10A-1: Student Community Creation Rejection (Isolated)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

DO $$
DECLARE
    v_student_ok BOOLEAN := false;
BEGIN
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

-- TEST-SEC-10A-2: Support Staff Authorized Creation (Isolated)
BEGIN;
SET ROLE postgres;
DELETE FROM public.communities WHERE slug = 'staff-created-comm-test';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333'; -- Carol Staff
SET LOCAL "request.jwt.claims" = jsonb_build_object(
    'sub', '33333333-3333-3333-3333-333333333333',
    'role', 'authenticated'
)::text;

INSERT INTO public.communities (id, name, slug, type, city, is_verified)
VALUES ('88888888-8888-8888-8888-888888888888', 'Staff Verified Residence', 'staff-created-comm-test', 'hostel', 'Gandhinagar', true);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.communities WHERE slug = 'staff-created-comm-test') THEN
        RAISE EXCEPTION 'TEST-SEC-10A-2 FAILED: Staff insert did not persist in database!';
    END IF;
    RAISE NOTICE 'TEST-SEC-10A-2 PASSED: Authenticated staff member successfully created community.';
END $$;
ROLLBACK;

-- TEST-SEC-10B-1: Student Self-Approval Rejection (Isolated)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

DO $$
DECLARE
    v_rows_updated INT;
    v_status community_request_status;
BEGIN
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

-- TEST-SEC-10B-2: Support Staff Authorized Approval (Isolated)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333'; -- Carol Staff
SET LOCAL "request.jwt.claims" = jsonb_build_object(
    'sub', '33333333-3333-3333-3333-333333333333',
    'role', 'authenticated'
)::text;

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

SELECT 'All 11 Security Unit Tests PASSED under authenticated role simulation.' AS final_result;
