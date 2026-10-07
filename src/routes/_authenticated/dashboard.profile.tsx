import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/site/SiteLayout";
import { errMsg } from "@/components/site/Confirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/dashboard/profile")({
  component: ProfilePage,
});

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  username: z.string().trim().regex(/^[a-zA-Z0-9_]{3,30}$/, "Username: 3-30 letters, numbers or _"),
  phone: z.string().trim().max(20),
});

function ProfilePage() {
  const { profile, refresh } = useAuth();
  const [form, setForm] = useState({ name: "", username: "", phone: "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (profile) setForm({ name: profile.name ?? "", username: profile.username ?? "", phone: profile.phone ?? "" });
  }, [profile]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Invalid input"); return; }
    setSaving(true);
    const { error } = await supabase.from("profiles").update(parsed.data).eq("id", profile!.id);
    setSaving(false);
    if (error) { toast.error(error.code === "23505" ? "Username is already taken" : errMsg(error)); return; }
    toast.success("Profile updated");
    refresh();
  }

  return (
    <div className="max-w-lg">
      <PageHeader title="Profile" description="Update your personal details." />
      <form onSubmit={save} className="panel space-y-4 p-5">
        <div className="space-y-1.5"><Label>Email</Label><Input value={profile?.email ?? ""} disabled /></div>
        <div className="space-y-1.5"><Label htmlFor="n">Name</Label><Input id="n" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="u">Username</Label><Input id="u" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="p">Phone</Label><Input id="p" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <Button type="submit" disabled={saving || !profile} className="rounded-full">{saving ? "Saving…" : "Save changes"}</Button>
      </form>
    </div>
  );
}
