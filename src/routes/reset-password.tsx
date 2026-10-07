import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — PANEL BAZAR BD" },
      { name: "description", content: "Choose a new password for your account." },
      { property: "og:title", content: "Set a new password — PANEL BAZAR BD" },
      { property: "og:description", content: "Choose a new password for your account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return void toast.error("Password must be at least 8 characters");
    if (pw !== confirm) return void toast.error("Passwords do not match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success("Password updated");
    navigate({ to: "/dashboard" });
  }
  return (
    <SiteLayout>
      <form onSubmit={submit} className="panel mx-auto my-10 w-full max-w-md space-y-4 p-6">
        <h1 className="text-xl font-bold">Set a new password</h1>
        <div className="space-y-1.5"><Label htmlFor="np">New password</Label><Input id="np" type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="cp">Confirm password</Label><Input id="cp" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
        <Button className="w-full rounded-full" disabled={busy}>{busy ? "Saving…" : "Update password"}</Button>
      </form>
    </SiteLayout>
  );
}
