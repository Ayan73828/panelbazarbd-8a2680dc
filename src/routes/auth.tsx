import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteLayout } from "@/components/site/SiteLayout";
import { errMsg } from "@/components/site/Confirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { Brand } from "@/components/site/Brand";
import { telegramNotifyEvent } from "@/lib/telegram-notifications.functions";

type Mode = "login" | "register";
type PendingOtp = { email: string; mode: Mode; name?: string; phone?: string; referralCode?: string };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { mode?: Mode | undefined; ref?: string } => ({
    mode: s["mode"] === "register" || s["mode"] === "login" ? s["mode"] : undefined,
    ref: typeof s["ref"] === "string" ? s["ref"].slice(0, 80) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Login or Register — PANEL BAZAR BD" },
      { name: "description", content: "Register and sign in securely using an email verification code." },
      { property: "og:title", content: "Login or Register — PANEL BAZAR BD" },
      { property: "og:description", content: "Login and register using an email verification code." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode: routeMode = "login", ref: referralCode } = Route.useSearch();

  useEffect(() => {
    if (referralCode) {
      try { sessionStorage.setItem("pending_website_referral_code", referralCode); } catch {}
    }
  }, [referralCode]);
  const [mode, setMode] = useState<Mode>(routeMode);
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => setMode(routeMode), [routeMode]);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  return (
    <SiteLayout>
      <div className="relative mx-auto w-full max-w-md px-4 py-8 sm:py-12">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"><span className="winter-orb winter-orb-one" /><span className="winter-orb winter-orb-two" /><span className="winter-snow winter-snow-one">✦</span><span className="winter-snow winter-snow-two">❄</span><span className="winter-snow winter-snow-three">✧</span></div>
        <div className="relative mb-5 flex flex-col items-center gap-3 text-center">
          <Brand />
          <span className="rounded-full border border-cyan-200/25 bg-cyan-300/10 px-3 py-1 text-[10px] font-bold tracking-[0.28em] text-cyan-100">WINTER ACCESS</span>
          <p className="text-sm text-slate-300">Enter the battlefield. Access your panel.</p>
        </div>
        <div className="panel relative overflow-hidden border-cyan-100/20 bg-slate-950/90 p-6 shadow-[0_20px_80px_rgba(8,145,178,0.16)] backdrop-blur-xl before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-cyan-100/70 before:to-transparent">
          <div className="mb-6 grid grid-cols-2 rounded-full border border-white/10 bg-white/[0.04] p-1 text-sm">
            <button type="button" onClick={() => setMode("login")} className={`rounded-full py-2 text-center font-medium ${mode === "login" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Login</button>
            <button type="button" onClick={() => setMode("register")} className={`rounded-full py-2 text-center font-medium ${mode === "register" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Register</button>
          </div>
          <OtpAuthForm mode={mode} referralCode={referralCode} />
          <p className="mt-5 text-center text-xs text-muted-foreground">Never share your email verification code with anyone.</p>
        </div>
      </div>
    </SiteLayout>
  );
}

function OtpAuthForm({ mode, referralCode }: { mode: Mode; referralCode?: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<PendingOtp | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function requestCode(e: FormEvent) {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (mode === "register") {
      if (name.trim().length < 2) return void toast.error("Please enter your full name.");
      if (!/^[+\d][\d\s-]{6,}$/.test(phone.trim())) return void toast.error("Please enter a valid phone number.");
    }
    setBusy(true);
    try {
      if (mode === "register") {
        // Supabase requires a password for signUp; this random value is never shown or stored by the app.
        // Users authenticate through email OTP, not this generated password.
        const randomPart = Array.from(crypto.getRandomValues(new Uint8Array(32)), (v) => v.toString(16).padStart(2, "0")).join("");
        const { error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password: `Aa1!${randomPart}`,
          options: { data: { name: name.trim(), full_name: name.trim(), phone: phone.trim() } },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email: normalizedEmail,
          options: { shouldCreateUser: false },
        });
        if (error) throw error;
      }
      setPending({ email: normalizedEmail, mode, ...(mode === "register" ? { name: name.trim(), phone: phone.trim() } : {}), ...(mode === "register" && referralCode ? { referralCode } : {}) });
      setCode("");
      toast.success("Code sent. Check your inbox and spam folder.");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    if (!pending) return;
    if (!/^(?:\d{6}|\d{8})$/.test(code.trim())) return void toast.error("Enter the complete code from your email.");
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: pending.email,
        token: code.trim(),
        type: pending.mode === "register" ? "signup" : "email",
      });
      if (error) throw error;
      sessionStorage.setItem("kr_alive", "1");
      if (pending.mode === "register") {
        // The reward is claimed only after the email OTP has been verified.
        const { error: profileError } = await supabase.rpc("ensure_profile");
        if (profileError) console.error("Profile bootstrap after signup failed", profileError);

        let savedReferralCode: string | null = pending.referralCode ?? null;
        try {
          savedReferralCode = savedReferralCode || sessionStorage.getItem("pending_website_referral_code");
        } catch {}
        if (savedReferralCode) {
          const { data: claimed, error: referralError } = await supabase.rpc("claim_referral_reward", {
            p_referral_code: savedReferralCode,
          });
          if (referralError) {
            console.error("Website referral reward claim failed", referralError);
            toast.error("Account verified, but the referral bonus could not be confirmed. Please contact Support before retrying.");
          } else {
            try { sessionStorage.removeItem("pending_website_referral_code"); } catch {}
            if (claimed === true) {
              toast.success("Referral successful! ৳৫ bonus added to your referrer.");
            } else {
              console.warn("Website referral reward not claimed (invalid referrer, self-referral, or already claimed).");
            }
          }
        }
        void telegramNotifyEvent({ data: { event: "signup" } }).catch((notifyError) => console.error("Telegram signup notification failed", notifyError));
        toast.success("Email verified and account created successfully!");
      } else {
        toast.success("Logged in successfully!");
      }
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {!pending ? (
        <form onSubmit={requestCode} className="space-y-4">
          <h1 className="text-xl font-bold tracking-tight">{mode === "login" ? "Login to your account" : "Create your account"}</h1>
          <p className="text-sm text-muted-foreground">{mode === "login" ? "Enter your registered email to continue." : "Enter your details to create your account."}</p>
          {mode === "register" && <>
            <div className="space-y-1.5"><Label htmlFor="register-name">Full name</Label><Input id="register-name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div>
            <div className="space-y-1.5"><Label htmlFor="register-phone">Phone</Label><Input id="register-phone" type="tel" required maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" /></div>
          </>}
          <div className="space-y-1.5"><Label htmlFor="auth-email">Email</Label><Input id="auth-email" type="email" required maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
          <Button type="submit" className="w-full rounded-full bg-cyan-200 font-bold text-slate-950 hover:bg-cyan-100" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign In with Email" : "Continue"}</Button>
{mode === "login" && <>
          <div className="flex items-center gap-3 py-1 text-[10px] font-semibold tracking-[0.2em] text-slate-500"><span className="h-px flex-1 bg-white/10" /> OR CONTINUE WITH <span className="h-px flex-1 bg-white/10" /></div>
          <Button type="button" variant="outline" className="w-full rounded-full border-white/15 bg-white/[0.04] text-foreground hover:bg-white/[0.08]" disabled={busy} onClick={async () => { setBusy(true); try { const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: "https://panelbazarbd.shop/dashboard" } }); if (error) throw error; } catch (err) { toast.error(errMsg(err)); setBusy(false); } }}><span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-sm font-bold text-[#4285F4]">G</span>Continue with Google</Button>
          </>}
        </form>
      ) : (
        <form onSubmit={verifyCode} className="space-y-4">
          <h1 className="text-xl font-bold">Verify your email</h1>
          <p className="text-sm text-muted-foreground">Enter the code sent to <span className="font-medium">{pending.email}</span>.</p>
          <div className="space-y-1.5"><Label htmlFor="auth-code">Enter your code</Label><Input id="auth-code" inputMode="numeric" autoComplete="one-time-code" type="text" required minLength={6} maxLength={8} pattern="(?:[0-9]{6}|[0-9]{8})" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))} /></div>
          <Button type="submit" className="w-full rounded-full" disabled={busy || !/^(?:\d{6}|\d{8})$/.test(code)}>{busy ? "Verifying…" : "Verify code and continue"}</Button>
          <Button type="button" variant="outline" className="w-full rounded-full" disabled={busy} onClick={() => { setPending(null); setCode(""); }}>Use a different email</Button>
          <p className="text-xs text-muted-foreground">If no email arrives, check spam. You can request another code after the email provider's cooldown.</p>
        </form>
      )}
    </div>
  );
}
