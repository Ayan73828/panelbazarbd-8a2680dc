CREATE OR REPLACE FUNCTION public.bot_purchase_package(p_user_id uuid, p_package_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE pk record; p record; pr record; k record; tot numeric(12,2); nb numeric(12,2); oid uuid;
BEGIN
  SELECT * INTO pk FROM public.product_packages WHERE id = p_package_id AND is_active FOR UPDATE;
  IF pk IS NULL THEN RAISE EXCEPTION 'Package unavailable'; END IF;
  SELECT * INTO p FROM public.products WHERE id = pk.product_id AND is_active;
  IF p IS NULL THEN RAISE EXCEPTION 'Product unavailable'; END IF;
  tot := pk.price;
  IF tot IS NULL OR tot <= 0 THEN RAISE EXCEPTION 'Price not set'; END IF;
  SELECT * INTO pr FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF pr IS NULL THEN RAISE EXCEPTION 'Profile missing'; END IF;
  IF NOT pr.is_active THEN RAISE EXCEPTION 'Account disabled'; END IF;
  SELECT * INTO k FROM public.product_keys WHERE package_id = pk.id AND NOT is_used ORDER BY created_at, id LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF k IS NULL THEN RAISE EXCEPTION 'NO_KEYS'; END IF;
  IF pr.balance < tot THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;
  nb := pr.balance - tot;
  PERFORM set_config('app.bypass_profile_guard','on',true);
  UPDATE public.profiles SET balance = nb WHERE id = p_user_id;
  INSERT INTO public.orders (user_id, product_id, product_name, quantity, unit_price, total, status, delivered_key, package_id, package_name)
  VALUES (p_user_id, p.id, p.name || ' — ' || pk.name, 1, tot, tot, 'completed', k.key_value, pk.id, pk.name) RETURNING id INTO oid;
  UPDATE public.product_keys SET is_used = true, used_by = p_user_id, order_id = oid, used_at = now() WHERE id = k.id;
  UPDATE public.products SET stock = (SELECT count(*) FROM public.product_keys WHERE product_id = p.id AND NOT is_used) WHERE id = p.id;
  INSERT INTO public.wallet_transactions (user_id, amount, type, description, balance_after)
  VALUES (p_user_id, -tot, 'purchase', 'Purchase (Telegram): ' || p.name || ' — ' || pk.name, nb);
  RETURN oid;
END; $function$;
REVOKE ALL ON FUNCTION public.bot_purchase_package(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_purchase_package(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.resolve_login_email(p_username text)
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT email FROM public.profiles WHERE lower(username) = lower(trim(p_username)) LIMIT 1 $$;
REVOKE ALL ON FUNCTION public.resolve_login_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO service_role;