-- Preserve original balances during Telegram/website account linking and
-- safely split the remaining combined balance when the Telegram account unlinks.
ALTER TABLE public.telegram_accounts
  ADD COLUMN IF NOT EXISTS guest_profile_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS linked_website_user_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS guest_balance_at_link numeric(12,2),
  ADD COLUMN IF NOT EXISTS website_balance_at_link numeric(12,2),
  ADD COLUMN IF NOT EXISTS link_balance_total_at_link numeric(12,2);

CREATE OR REPLACE FUNCTION public.bot_link_telegram_account(p_telegram_user_id bigint, p_target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  guest_row public.telegram_accounts%ROWTYPE;
  guest_balance numeric(12,2);
  website_balance numeric(12,2);
BEGIN
  SELECT * INTO guest_row FROM public.telegram_accounts
    WHERE telegram_user_id = p_telegram_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Telegram account not found'; END IF;
  IF guest_row.user_id = p_target_user_id THEN RAISE EXCEPTION 'Already linked'; END IF;
  IF NOT guest_row.is_guest THEN RAISE EXCEPTION 'Telegram account already linked'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target_user_id AND is_active) THEN
    RAISE EXCEPTION 'Website account unavailable';
  END IF;
  IF EXISTS (SELECT 1 FROM public.telegram_links WHERE user_id = p_target_user_id AND telegram_user_id <> p_telegram_user_id) THEN
    RAISE EXCEPTION 'Website account already linked to another Telegram account';
  END IF;

  SELECT balance INTO guest_balance FROM public.profiles WHERE id = guest_row.user_id FOR UPDATE;
  SELECT balance INTO website_balance FROM public.profiles WHERE id = p_target_user_id FOR UPDATE;
  IF guest_balance IS NULL OR website_balance IS NULL THEN RAISE EXCEPTION 'Account balance unavailable'; END IF;

  UPDATE public.telegram_accounts
    SET guest_profile_id = guest_row.user_id,
        linked_website_user_id = p_target_user_id,
        guest_balance_at_link = guest_balance,
        website_balance_at_link = website_balance,
        link_balance_total_at_link = guest_balance + website_balance,
        updated_at = now()
    WHERE telegram_user_id = p_telegram_user_id;

  PERFORM set_config('app.bypass_profile_guard','on',true);
  UPDATE public.profiles SET balance = balance + guest_balance, updated_at = now()
    WHERE id = p_target_user_id;
  UPDATE public.profiles SET balance = 0, updated_at = now() WHERE id = guest_row.user_id;

  UPDATE public.orders SET user_id = p_target_user_id WHERE user_id = guest_row.user_id;
  UPDATE public.wallet_transactions SET user_id = p_target_user_id WHERE user_id = guest_row.user_id;
  UPDATE public.product_keys SET used_by = p_target_user_id WHERE used_by = guest_row.user_id;
  UPDATE public.payments SET user_id = p_target_user_id WHERE user_id = guest_row.user_id;
  UPDATE public.uddoktapay_payments SET user_id = p_target_user_id WHERE user_id = guest_row.user_id;
  UPDATE public.referrals SET referrer_id = p_target_user_id WHERE referrer_id = guest_row.user_id;
  UPDATE public.referrals SET referred_user_id = p_target_user_id WHERE referred_user_id = guest_row.user_id;
  UPDATE public.telegram_support_tickets SET user_id = p_target_user_id WHERE user_id = guest_row.user_id;
  UPDATE public.support_tickets SET user_id = p_target_user_id WHERE user_id = guest_row.user_id;

  DELETE FROM public.telegram_links WHERE telegram_user_id = p_telegram_user_id;
  INSERT INTO public.telegram_links(user_id, telegram_user_id, telegram_chat_id, telegram_username)
  VALUES (p_target_user_id, p_telegram_user_id, guest_row.telegram_chat_id, guest_row.telegram_username);
  UPDATE public.telegram_accounts
    SET user_id = p_target_user_id, is_guest = false, updated_at = now()
    WHERE telegram_user_id = p_telegram_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.bot_unlink_telegram_account(p_telegram_user_id bigint)
RETURNS TABLE(guest_balance numeric, website_balance numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  account_row public.telegram_accounts%ROWTYPE;
  combined_balance numeric(12,2);
  original_total numeric(12,2);
  guest_share numeric(12,2);
  website_share numeric(12,2);
BEGIN
  SELECT * INTO account_row FROM public.telegram_accounts
    WHERE telegram_user_id = p_telegram_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Telegram account not found'; END IF;
  IF account_row.is_guest THEN RAISE EXCEPTION 'Telegram account is not linked'; END IF;
  IF account_row.guest_profile_id IS NULL OR account_row.linked_website_user_id IS NULL
     OR account_row.guest_balance_at_link IS NULL OR account_row.website_balance_at_link IS NULL THEN
    RAISE EXCEPTION 'SPLIT_METADATA_MISSING';
  END IF;
  IF account_row.user_id <> account_row.linked_website_user_id THEN
    RAISE EXCEPTION 'Linked account metadata mismatch';
  END IF;

  SELECT balance INTO combined_balance FROM public.profiles
    WHERE id = account_row.linked_website_user_id FOR UPDATE;
  IF combined_balance IS NULL THEN RAISE EXCEPTION 'Website account unavailable'; END IF;
  PERFORM 1 FROM public.profiles WHERE id = account_row.guest_profile_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Guest account unavailable'; END IF;

  original_total := account_row.guest_balance_at_link + account_row.website_balance_at_link;
  IF original_total > 0 THEN
    guest_share := round(combined_balance * account_row.guest_balance_at_link / original_total, 2);
  ELSE
    guest_share := round(combined_balance / 2, 2);
  END IF;
  website_share := combined_balance - guest_share;

  PERFORM set_config('app.bypass_profile_guard','on',true);
  UPDATE public.profiles SET balance = guest_share, updated_at = now()
    WHERE id = account_row.guest_profile_id;
  UPDATE public.profiles SET balance = website_share, updated_at = now()
    WHERE id = account_row.linked_website_user_id;

  DELETE FROM public.telegram_links WHERE telegram_user_id = p_telegram_user_id;
  UPDATE public.telegram_accounts
    SET user_id = account_row.guest_profile_id,
        is_guest = true,
        guest_profile_id = NULL,
        linked_website_user_id = NULL,
        guest_balance_at_link = NULL,
        website_balance_at_link = NULL,
        link_balance_total_at_link = NULL,
        updated_at = now()
    WHERE telegram_user_id = p_telegram_user_id;

  RETURN QUERY SELECT guest_share, website_share;
END;
$function$;

REVOKE ALL ON FUNCTION public.bot_link_telegram_account(bigint, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bot_unlink_telegram_account(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_link_telegram_account(bigint, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bot_unlink_telegram_account(bigint) TO service_role;
