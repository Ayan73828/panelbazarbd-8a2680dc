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

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { mode?: Mode | undefined } => ({
    mode: s["mode"] === "register" || s["mode"] === "login" ? s["mode"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Login or Register — PANEL BAZAR BD" },
      { name: "description", content: "Sign in or create your reseller account with email and password." },
      { property: "og:title", content: "Login or Register — PANEL BAZAR BD" },
      { property: "og:description", content: "Login and register with email and password." },
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
          <p className="mt-5 text-center text-xs text-muted-foreground">To change your password, please contact the admin.</p>
        </div>
      </div>
    </SiteLayout>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function login(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
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

  return (
    <form onSubmit={login} className="space-y-4">
      <h1 className="text-xl font-bold">Login to your account</h1>
      <p className="text-sm text-muted-foreground">Enter your registered email and password.</p>
      <div className="space-y-1.5"><Label htmlFor="login-email">Email</Label><Input id="login-email" type="email" required maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
      <div className="space-y-1.5"><Label htmlFor="login-password">Password</Label><Input id="login-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></div>
      <Button type="submit" className="w-full rounded-full" disabled={busy}>{busy ? "Logging in…" : "Login"}</Button>
    </form>
  );
}

function RegisterForm() {
  const [f, setF] = useState({ name: "", phone: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const up = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function register(e: FormEvent) {
    e.preventDefault();
    if (f.name.trim().length < 2) return void toast.error("Please enter your full name.");
    if (!/^[+\d][\d\s-]{6,}$/.test(f.phone.trim())) return void toast.error("Please enter a valid phone number.");
    if (f.password.length < 6) return void toast.error("Password must be at least 6 characters.");
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: f.email.trim(),
        password: f.password,
        options: { data: { name: f.name.trim(), full_name: f.name.trim(), phone: f.phone.trim() } },
      });
      if (error) throw error;
      if (!data.session) {
        toast.error("Email confirmation is still enabled. Please ask the admin to disable it in Supabase Auth settings.");
        return;
      }
      sessionStorage.setItem("kr_alive", "1");
      void telegramNotifyEvent({ data: { event: "signup" } }).catch((notifyError) => console.error("Telegram signup notification failed", notifyError));
      toast.success("Account created successfully!");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={register} className="space-y-4">
      <h1 className="text-xl font-bold">Create an account</h1>
      <p className="text-sm text-muted-foreground">Register with your email and password. No email code is needed.</p>
      <div className="space-y-1.5"><Label htmlFor="register-name">Full name</Label><Input id="register-name" required maxLength={80} value={f.name} onChange={up("name")} autoComplete="name" /></div>
      <div className="space-y-1.5"><Label htmlFor="register-phone">Phone</Label><Input id="register-phone" type="tel" required maxLength={20} value={f.phone} onChange={up("phone")} autoComplete="tel" /></div>
      <div className="space-y-1.5"><Label htmlFor="register-email">Email</Label><Input id="register-email" type="email" required maxLength={255} value={f.email} onChange={up("email")} autoComplete="email" /></div>
      <div className="space-y-1.5"><Label htmlFor="register-password">Password (at least 6 characters)</Label><Input id="register-password" type="password" required minLength={6} value={f.password} onChange={up("password")} autoComplete="new-password" /></div>
      <Button type="submit" className="w-full rounded-full" disabled={busy}>{busy ? "Creating account…" : "Register"}</Button>
    </form>
  );
}
