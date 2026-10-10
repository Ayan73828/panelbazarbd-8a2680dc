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
  const [mode, setMode] = useState<Mode>(routeMode);
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => setMode(routeMode), [routeMode]);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  return (
    <SiteLayout>
      <div className="mx-auto w-full max-w-md px-4 py-10">
        <div className="panel p-6">
          <div className="mb-6 grid grid-cols-2 rounded-full bg-surface-2 p-1 text-sm">
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
        type: "email",
      });
      if (error) throw error;
      sessionStorage.setItem("kr_alive", "1");
      if (pending.mode === "register") {
        if (pending.referralCode) {
          const { error: referralError } = await supabase.rpc("claim_referral_reward", { p_referral_code: pending.referralCode });
          if (referralError) console.error("Referral reward claim failed", referralError);
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
          <h1 className="text-xl font-bold">{mode === "login" ? "Login with email OTP" : "Create your account"}</h1>
          <p className="text-sm text-muted-foreground">{mode === "login" ? "Enter your registered email to continue." : "Enter your details to create your account."}</p>
          {mode === "register" && <>
            <div className="space-y-1.5"><Label htmlFor="register-name">Full name</Label><Input id="register-name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div>
            <div className="space-y-1.5"><Label htmlFor="register-phone">Phone</Label><Input id="register-phone" type="tel" required maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" /></div>
          </>}
          <div className="space-y-1.5"><Label htmlFor="auth-email">Email</Label><Input id="auth-email" type="email" required maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
          <Button type="submit" className="w-full rounded-full" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Login" : "Continue"}</Button>
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
