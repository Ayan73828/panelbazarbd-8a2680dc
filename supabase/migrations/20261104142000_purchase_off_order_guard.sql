-- Enforce Purchase Off across all website purchase RPCs and checkout paths.
CREATE OR REPLACE FUNCTION public.reject_orders_when_purchase_off()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(COALESCE((SELECT value FROM public.site_settings WHERE key = 'purchase_off'), 'false')) = 'true' THEN
    RAISE EXCEPTION 'PURCHASE_DISABLED';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_purchase_off_guard ON public.orders;
CREATE TRIGGER orders_purchase_off_guard
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.reject_orders_when_purchase_off();
