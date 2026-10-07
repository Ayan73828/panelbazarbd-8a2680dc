import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/site/SiteLayout";
import { errMsg } from "@/components/site/Confirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard/password")({
  component: PasswordPage,
});

function PasswordPage() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (pw !== pw2) { toast.error("Passwords do not match"); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setSaving(false);
    if (error) { toast.error(errMsg(error)); return; }
    setPw(""); setPw2("");
    toast.success("Password changed");
  }
  return (
    <div className="max-w-lg">
      <PageHeader title="Change Password" />
      <form onSubmit={save} className="panel space-y-4 p-5">
        <div className="space-y-1.5"><Label htmlFor="a">New password</Label><Input id="a" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></div>
        <div className="space-y-1.5"><Label htmlFor="b">Confirm new password</Label><Input id="b" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></div>
        <Button type="submit" disabled={saving} className="rounded-full">{saving ? "Saving…" : "Update password"}</Button>
      </form>
    </div>
  );
}
