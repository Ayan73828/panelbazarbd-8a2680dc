CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  reward_amount numeric(12,2) NOT NULL DEFAULT 5 CHECK (reward_amount = 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (referrer_id <> referred_user_id)
);
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
CREATE POLICY referrals_read_own ON public.referrals FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referred_user_id = auth.uid());

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
