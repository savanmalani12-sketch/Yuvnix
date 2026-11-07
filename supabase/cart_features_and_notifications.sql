-- =============================================================================
-- YUVNIX: CART FREE DELIVERY GOAL, FIX ADD ITEM & RESIDENCE NOTIFICATIONS
-- Target: Supabase Cloud SQL Editor (https://supabase.com/dashboard/project/rzjtsbumyqifvdvwpozg/sql)
-- =============================================================================

-- 1. Add free delivery threshold and host initial amount columns to group_carts
ALTER TABLE public.group_carts 
    ADD COLUMN IF NOT EXISTS host_initial_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS target_amount NUMERIC(10, 2) DEFAULT NULL;

-- 2. Grant table column privileges
GRANT INSERT (host_initial_amount, target_amount), UPDATE (host_initial_amount, target_amount) ON public.group_carts TO authenticated;
GRANT INSERT (is_fulfilled) ON public.cart_items TO authenticated;
GRANT SELECT, INSERT ON public.notifications TO authenticated;
GRANT UPDATE (is_read) ON public.notifications TO authenticated;

-- 3. Automatic community-wide notification when a new group cart is started
CREATE OR REPLACE FUNCTION public.notify_community_new_cart()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_creator_name TEXT;
    v_comm_name TEXT;
    v_needed NUMERIC(10, 2);
    v_body TEXT;
BEGIN
    SELECT full_name INTO v_creator_name FROM public.profiles WHERE id = NEW.created_by_user_id;
    SELECT name INTO v_comm_name FROM public.communities WHERE id = NEW.community_id;
    
    v_needed := CASE 
        WHEN NEW.target_amount IS NOT NULL AND NEW.target_amount > COALESCE(NEW.host_initial_amount, 0)
        THEN NEW.target_amount - COALESCE(NEW.host_initial_amount, 0)
        ELSE NULL 
    END;

    IF v_needed IS NOT NULL AND v_needed > 0 THEN
        v_body := COALESCE(v_creator_name, 'A neighbor') || ' started a ' || COALESCE(NEW.store_name, 'grocery') || ' cart! Only ₹' || v_needed::INT || ' needed for FREE delivery.';
    ELSE
        v_body := COALESCE(v_creator_name, 'A neighbor') || ' started an order at ' || COALESCE(NEW.store_name, 'the store') || '. Add your snacks to share delivery!';
    END IF;

    -- Insert notifications for all active members in the residence except the cart creator
    INSERT INTO public.notifications (user_id, type, title, body, link_url)
    SELECT 
        cm.user_id,
        'cart_lock_imminent'::notification_type,
        '🛒 New Group Cart: ' || NEW.title,
        v_body,
        '/carts'
    FROM public.community_memberships cm
    WHERE cm.community_id = NEW.community_id
      AND cm.is_active = true
      AND cm.user_id != NEW.created_by_user_id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_community_new_cart ON public.group_carts;
CREATE TRIGGER trg_notify_community_new_cart
    AFTER INSERT ON public.group_carts
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_community_new_cart();

-- 4. Auto-update total_estimated_amount on group_carts when items change
CREATE OR REPLACE FUNCTION public.update_cart_total_estimated_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cart_id UUID;
    v_items_sum NUMERIC(10, 2);
    v_host_initial NUMERIC(10, 2);
BEGIN
    v_cart_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.cart_id ELSE NEW.cart_id END;

    SELECT COALESCE(SUM(quantity * COALESCE(unit_price_estimate, 0)), 0)
    INTO v_items_sum
    FROM public.cart_items
    WHERE cart_id = v_cart_id;

    SELECT COALESCE(host_initial_amount, 0)
    INTO v_host_initial
    FROM public.group_carts
    WHERE id = v_cart_id;

    UPDATE public.group_carts
    SET total_estimated_amount = v_items_sum + v_host_initial,
        updated_at = now()
    WHERE id = v_cart_id;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_cart_total ON public.cart_items;
CREATE TRIGGER trg_update_cart_total
    AFTER INSERT OR UPDATE OR DELETE ON public.cart_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_cart_total_estimated_amount();
