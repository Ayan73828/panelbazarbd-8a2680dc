REVOKE EXECUTE ON FUNCTION public.verify_payment(text, numeric, text) FROM authenticated, anon;
COMMENT ON FUNCTION public.verify_payment(text, numeric, text) IS 'DEPRECATED: manual TRX verification removed; deposits go through UddoktaPay only';
COMMENT ON TABLE public.accepted_trx IS 'DEPRECATED: manual TRX system removed; kept for payment history only';