-- =============================================================================
-- FIX: ALLOW STUDENTS TO JOIN VERIFIED RESIDENTIAL COMMUNITIES
-- Target: Supabase Cloud SQL Editor (https://supabase.com/dashboard/project/rzjtsbumyqifvdvwpozg/sql)
-- =============================================================================

-- 1. Grant table privileges on community_memberships to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_memberships TO authenticated;

-- 2. Update INSERT policy: Allow students to join any verified community
DROP POLICY IF EXISTS "memberships_insert_authorized" ON public.community_memberships;
CREATE POLICY "memberships_insert_authorized"
    ON public.community_memberships FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_staff_or_admin() OR
        (auth.uid() = user_id AND EXISTS (
            SELECT 1 FROM public.communities c
            WHERE c.id = community_id AND c.is_verified = true
        ))
    );

-- 3. Update UPDATE policy: Allow students to update/toggle their own membership
DROP POLICY IF EXISTS "memberships_update_staff_only" ON public.community_memberships;
DROP POLICY IF EXISTS "memberships_update_self_or_staff" ON public.community_memberships;
CREATE POLICY "memberships_update_self_or_staff"
    ON public.community_memberships FOR UPDATE
    TO authenticated
    USING (
        user_id = auth.uid() OR public.is_staff_or_admin()
    )
    WITH CHECK (
        user_id = auth.uid() OR public.is_staff_or_admin()
    );

-- 4. Create atomic join_community RPC (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.join_community(p_community_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_is_verified BOOLEAN;
    v_new_count INT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'You must be signed in to join a residence.';
    END IF;

    SELECT is_verified INTO v_is_verified
    FROM public.communities
    WHERE id = p_community_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Residential community not found.';
    END IF;

    IF NOT v_is_verified THEN
        RAISE EXCEPTION 'This community is pending verification by support staff.';
    END IF;

    -- Upsert membership as active
    INSERT INTO public.community_memberships (community_id, user_id, is_active, joined_at)
    VALUES (p_community_id, v_user_id, true, now())
    ON CONFLICT (community_id, user_id)
    DO UPDATE SET is_active = true, joined_at = now();

    -- Synchronize active resident member count
    SELECT count(*) INTO v_new_count
    FROM public.community_memberships
    WHERE community_id = p_community_id AND is_active = true;

    UPDATE public.communities
    SET active_member_count = v_new_count
    WHERE id = p_community_id;

    RETURN jsonb_build_object(
        'success', true,
        'action', 'joined',
        'community_id', p_community_id,
        'active_member_count', v_new_count
    );
END;
$$;

-- 5. Create atomic leave_community RPC (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.leave_community(p_community_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_new_count INT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'You must be signed in to leave a residence.';
    END IF;

    UPDATE public.community_memberships
    SET is_active = false
    WHERE community_id = p_community_id AND user_id = v_user_id;

    SELECT count(*) INTO v_new_count
    FROM public.community_memberships
    WHERE community_id = p_community_id AND is_active = true;

    UPDATE public.communities
    SET active_member_count = v_new_count
    WHERE id = p_community_id;

    RETURN jsonb_build_object(
        'success', true,
        'action', 'left',
        'community_id', p_community_id,
        'active_member_count', v_new_count
    );
END;
$$;

-- 6. Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.join_community(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_community(UUID) TO authenticated;
