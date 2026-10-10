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

type Mode = "login" | "register";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { mode?: Mode | undefined } => ({
    mode: s["mode"] === "register" || s["mode"] === "login" ? s["mode"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Login or Register — PANEL BAZAR BD" },
      { name: "description", content: "Sign in or create your reseller account using an email verification code." },
      { property: "og:title", content: "Login or Register — PANEL BAZAR BD" },
      { property: "og:description", content: "Sign in or create your reseller account using an email verification code." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode = "login" } = Route.useSearch();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  return (
    <SiteLayout>
      <div className="mx-auto w-full max-w-md px-4 py-10">
        <div className="panel p-6">
          <div className="mb-6 grid grid-cols-2 rounded-full bg-surface-2 p-1 text-sm">
            <Link to="/auth" search={{ mode: "login" }} className={`rounded-full py-2 text-center font-medium ${mode === "login" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Login</Link>
            <Link to="/auth" search={{ mode: "register" }} className={`rounded-full py-2 text-center font-medium ${mode === "register" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Register</Link>
          </div>
          {mode === "login" ? <LoginForm /> : <RegisterForm />}
        </div>
      </div>
    </SiteLayout>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      setSent(true);
      toast.success("Verification code sent to your email.");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp.trim())) return void toast.error("Enter the 6-digit code from your email.");
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: "email",
      });
      if (error) throw error;
      sessionStorage.setItem("kr_alive", "1");
      toast.success("Logged in successfully!");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return sent ? (
    <form onSubmit={verifyCode} className="space-y-4">
      <h1 className="text-xl font-bold">Enter email code</h1>
      <p className="text-sm text-muted-foreground">We sent a 6-digit code to {email}. Enter it here to log in.</p>
      <div className="space-y-1.5"><Label htmlFor="login-otp">6-digit code</Label><Input id="login-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} /></div>
      <Button type="submit" className="w-full rounded-full" disabled={busy}>{busy ? "Verifying…" : "Verify code & login"}</Button>
      <button type="button" className="w-full text-sm text-primary hover:underline" onClick={() => { setSent(false); setOtp(""); }}>Use another email</button>
    </form>
  ) : (
    <form onSubmit={sendCode} className="space-y-4">
      <h1 className="text-xl font-bold">Login to your account</h1>
      <p className="text-sm text-muted-foreground">Enter your registered email. We’ll send you a one-time code—no password needed.</p>
      <div className="space-y-1.5"><Label htmlFor="login-email">Email</Label><Input id="login-email" type="email" required maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
      <Button type="submit" className="w-full rounded-full" disabled={busy}>{busy ? "Sending code…" : "Send login code"}</Button>
    </form>
  );
}

function RegisterForm() {
  const [f, setF] = useState({ name: "", phone: "", email: "" });
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const up = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    if (f.name.trim().length < 2) return void toast.error("Please enter your full name.");
    if (!/^[+\d][\d\s-]{6,}$/.test(f.phone.trim())) return void toast.error("Please enter a valid phone number.");
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: f.email.trim(),
        options: {
          shouldCreateUser: true,
          data: { name: f.name.trim(), full_name: f.name.trim(), phone: f.phone.trim() },
        },
      });
      if (error) throw error;
      setSent(true);
      toast.success("Verification code sent to your email.");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp.trim())) return void toast.error("Enter the 6-digit code from your email.");
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: f.email.trim(),
        token: otp.trim(),
        type: "email",
      });
      if (error) throw error;
      if (!data.session) throw new Error("Email verified, but no login session was created. Please return to login and request a new code.");
      sessionStorage.setItem("kr_alive", "1");
      toast.success("Email verified. Your account is ready!");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return sent ? (
    <form onSubmit={verifyCode} className="space-y-4">
      <h1 className="text-xl font-bold">Verify your email</h1>
      <p className="text-sm text-muted-foreground">We sent a 6-digit code to {f.email}. Enter it to finish registration and log in.</p>
      <div className="space-y-1.5"><Label htmlFor="register-otp">6-digit code</Label><Input id="register-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} /></div>
      <Button type="submit" className="w-full rounded-full" disabled={busy}>{busy ? "Verifying…" : "Verify code & continue"}</Button>
      <button type="button" className="w-full text-sm text-primary hover:underline" onClick={() => { setSent(false); setOtp(""); }}>Use another email</button>
    </form>
  ) : (
    <form onSubmit={sendCode} className="space-y-4">
      <h1 className="text-xl font-bold">Create an account</h1>
      <p className="text-sm text-muted-foreground">Enter your details. We’ll email you a code to verify your address.</p>
      <div className="space-y-1.5"><Label htmlFor="register-name">Full name</Label><Input id="register-name" required maxLength={80} value={f.name} onChange={up("name")} autoComplete="name" /></div>
      <div className="space-y-1.5"><Label htmlFor="register-phone">Phone</Label><Input id="register-phone" type="tel" required maxLength={20} value={f.phone} onChange={up("phone")} autoComplete="tel" /></div>
      <div className="space-y-1.5"><Label htmlFor="register-email">Email</Label><Input id="register-email" type="email" required maxLength={255} value={f.email} onChange={up("email")} autoComplete="email" /></div>
      <Button type="submit" className="w-full rounded-full" disabled={busy}>{busy ? "Sending code…" : "Send verification code"}</Button>
    </form>
  );
}
