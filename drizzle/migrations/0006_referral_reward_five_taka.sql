-- Increase the referral reward to ৳5. Wallet balances use USD units,
-- and the UI displays balances at 100 BDT per USD.
ALTER TABLE public.referrals ALTER COLUMN reward_amount SET DEFAULT 5;
ALTER TABLE public.referrals DROP CONSTRAINT IF EXISTS referrals_reward_amount_check;
ALTER TABLE public.referrals ADD CONSTRAINT referrals_reward_amount_check CHECK (reward_amount = 5);

CREATE OR REPLACE FUNCTION public.claim_referral_reward(p_referral_code text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_user uuid := auth.uid();
  referrer uuid;
  current_balance numeric(12,2);
BEGIN
  IF new_user IS NULL OR p_referral_code IS NULL OR length(trim(p_referral_code)) = 0 THEN RETURN false; END IF;
  BEGIN
    referrer := trim(p_referral_code)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN RETURN false;
  END;
  IF referrer = new_user THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = new_user) THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = referrer AND is_active = true) THEN RETURN false; END IF;

  INSERT INTO public.referrals(referrer_id, referred_user_id, reward_amount)
  VALUES (referrer, new_user, 5)
  ON CONFLICT (referred_user_id) DO NOTHING;
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT balance INTO current_balance FROM public.profiles WHERE id = referrer FOR UPDATE;
  PERFORM set_config('app.bypass_profile_guard','on',true);
  UPDATE public.profiles SET balance = balance + 0.05 WHERE id = referrer;
  INSERT INTO public.wallet_transactions(user_id, amount, type, description, balance_after)
  VALUES (referrer, 0.05, 'referral_reward', 'Referral reward ৳5', current_balance + 0.05);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_referral_reward(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_referral_reward(text) TO authenticated;
