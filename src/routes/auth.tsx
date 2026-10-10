import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteLayout } from "@/components/site/SiteLayout";
import { errMsg } from "@/components/site/Confirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";

type Mode = "login" | "register" | "forgot";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { mode?: Mode | undefined } => ({
    mode: s["mode"] === "register" || s["mode"] === "forgot" || s["mode"] === "login" ? s["mode"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Login or Register — PANEL BAZAR BD" },
      { name: "description", content: "Sign in or create your reseller account to buy with your wallet balance." },
      { property: "og:title", content: "Login or Register — PANEL BAZAR BD" },
      { property: "og:description", content: "Sign in or create your reseller account." },
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
          {mode !== "forgot" && (
            <div className="mb-6 grid grid-cols-2 rounded-full bg-surface-2 p-1 text-sm">
              <Link to="/auth" search={{ mode: "login" }} className={`rounded-full py-2 text-center font-medium ${mode === "login" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Login</Link>
              <Link to="/auth" search={{ mode: "register" }} className={`rounded-full py-2 text-center font-medium ${mode === "register" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Register</Link>
            </div>
          )}
          {mode === "login" && <LoginForm />}
          {mode === "register" && <RegisterForm />}
          {mode === "forgot" && <ForgotForm />}
        </div>
      </div>
    </SiteLayout>
  );
}

function LoginForm() {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const email = id.trim();
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) throw new Error(error.message === "Invalid login credentials" ? "Invalid username/email or password" : error.message);
      localStorage.setItem("kr_remember", remember ? "1" : "0");
      sessionStorage.setItem("kr_alive", "1");
      toast.success("Welcome back!");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-xl font-bold">Login to your account</h1>
      <div className="space-y-1.5"><Label htmlFor="id">Email</Label><Input id="id" type="email" required value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" /></div>
      <div className="space-y-1.5"><Label htmlFor="pw">Password</Label><Input id="pw" type="password" required value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></div>
      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-2"><Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} /> Remember me</label>
        <Link to="/auth" search={{ mode: "forgot" }} className="text-primary hover:underline">Forgot password?</Link>
      </div>
      <Button type="submit" className="w-full rounded-full" disabled={busy}>{busy ? "Signing in…" : "Login"}</Button>
    </form>
  );
}

function RegisterForm() {
  const [f, setF] = useState({ name: "", username: "", email: "", phone: "", password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const navigate = useNavigate();
  const up = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const username = f.username.trim().toLowerCase();
    if (f.name.trim().length < 2) return void toast.error("Please enter your full name");
    if (!/^[a-z0-9_]{3,24}$/.test(username)) return void toast.error("Username: 3-24 letters, numbers or _");
    if (!/^[+\d][\d\s-]{6,}$/.test(f.phone.trim())) return void toast.error("Please enter a valid phone number");
    if (f.password.length < 8) return void toast.error("Password must be at least 8 characters");
    if (f.password !== f.confirm) return void toast.error("Passwords do not match");
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: f.email.trim(),
        password: f.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { name: f.name.trim(), username, phone: f.phone.trim() },
        },
      });
      if (error) throw error;
      if (data.session) {
        toast.success("Account created!");
        navigate({ to: "/dashboard", replace: true });
      } else setDone(true);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function verifyEmail(e: FormEvent) {
    e.preventDefault();
    const code = otp.trim();
    if (!/^\\d{6}$/.test(code)) return void toast.error("Enter the 6-digit code from your email");
    setVerifying(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: f.email.trim(),
        token: code,
        type: "signup",
      });
      if (error) throw error;
      if (data.session) {
        toast.success("Email verified! Account created.");
        navigate({ to: "/dashboard", replace: true });
      } else {
        toast.success("Email verified. You can now log in.");
        navigate({ to: "/auth", search: { mode: "login" }, replace: true });
      }
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setVerifying(false);
    }
  }

  if (done)
    return (
      <form onSubmit={verifyEmail} className="space-y-4">
        <h1 className="text-xl font-bold">Verify your email</h1>
        <p className="text-sm text-muted-foreground">We sent a 6-digit verification code to {f.email}. Enter the code below to activate your account.</p>
        <div className="space-y-1.5"><Label htmlFor="signup-otp">Email verification code</Label><Input id="signup-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={otp} onChange={(e) => setOtp(e.target.value.replace(/\\D/g, "").slice(0, 6))} /></div>
        <Button type="submit" className="w-full rounded-full" disabled={verifying}>{verifying ? "Verifying…" : "Verify email"}</Button>
      </form>
    );

  return (
    <form onSubmit={submit} className="space-y-3">
      <h1 className="text-xl font-bold">Create an account</h1>
      <div className="space-y-1.5"><Label htmlFor="name">Full name</Label><Input id="name" required maxLength={80} value={f.name} onChange={up("name")} /></div>
      <div className="space-y-1.5"><Label htmlFor="username">Username</Label><Input id="username" required maxLength={24} value={f.username} onChange={up("username")} /></div>
      <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" required maxLength={255} value={f.email} onChange={up("email")} /></div>
      <div className="space-y-1.5"><Label htmlFor="phone">Phone</Label><Input id="phone" type="tel" required maxLength={20} value={f.phone} onChange={up("phone")} /></div>
      <div className="space-y-1.5"><Label htmlFor="password">Password</Label><Input id="password" type="password" required value={f.password} onChange={up("password")} autoComplete="new-password" /></div>
      <div className="space-y-1.5"><Label htmlFor="confirm">Confirm password</Label><Input id="confirm" type="password" required value={f.confirm} onChange={up("confirm")} autoComplete="new-password" /></div>
      <Button type="submit" className="w-full rounded-full" disabled={busy}>{busy ? "Creating…" : "Register"}</Button>
    </form>
  );
}

function ForgotForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    if (error) return void toast.error(error.message);
    setSent(true);
  }
  return sent ? (
    <div className="space-y-3 text-center">
      <h1 className="text-xl font-bold">Check your email</h1>
      <p className="text-sm text-muted-foreground">If an account exists for {email}, a reset link is on its way.</p>
      <Link to="/auth" search={{ mode: "login" }} className="text-sm text-primary">Back to login</Link>
    </div>
  ) : (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-xl font-bold">Reset your password</h1>
      <div className="space-y-1.5"><Label htmlFor="femail">Email</Label><Input id="femail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <Button type="submit" className="w-full rounded-full" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</Button>
      <Link to="/auth" search={{ mode: "login" }} className="block text-center text-sm text-muted-foreground">Back to login</Link>
    </form>
  );
}
