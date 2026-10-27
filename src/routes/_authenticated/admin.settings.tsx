import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { adminConnectTelegram } from "@/lib/admin.functions";
import { AdminHeader, SettingsForm } from "@/components/admin/kit";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/hooks/useSite";

export const Route = createFileRoute("/_authenticated/admin/settings")({ component: AdminSettings });

function AdminSettings() {
  const [connectingTelegram, setConnectingTelegram] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const queryClient = useQueryClient();
  const { settings } = useSettings();
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [discountPercent, setDiscountPercent] = useState("10");
  const [discountDays, setDiscountDays] = useState("1");
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [savingDiscount, setSavingDiscount] = useState(false);
  const discountQuery = useQuery({
    queryKey: ["global-discount-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_settings").select("key,value").in("key", ["global_discount_percent", "global_discount_until", "global_discount_enabled"]);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((row) => [row.key, row.value ?? ""]));
    },
  });
  useEffect(() => {
    const d = discountQuery.data;
    if (!d) return;
    setDiscountPercent(d.global_discount_percent || "10");
    setDiscountEnabled(d.global_discount_enabled === "true" && !!d.global_discount_until && new Date(d.global_discount_until).getTime() > Date.now());
  }, [discountQuery.data]);
  async function startDiscount() {
    const percent = Number(discountPercent), days = Number(discountDays);
    if (!Number.isFinite(percent) || percent < 1 || percent > 90) { toast.error("Discount must be between 1% and 90%"); return; }
    if (!Number.isFinite(days) || days < 1 || days > 30) { toast.error("Duration must be 1–30 days"); return; }
    setSavingDiscount(true);
    try {
      const until = new Date(Date.now() + days * 86400000).toISOString();
      const { error } = await supabase.from("site_settings").upsert([
        { key: "global_discount_percent", value: String(percent) },
        { key: "global_discount_until", value: until },
        { key: "global_discount_enabled", value: "true" },
      ], { onConflict: "key" });
      if (error) throw error;
      await queryClient.invalidateQueries();
      setDiscountEnabled(true);
      toast.success(`${percent}% discount started for ${days} day(s)`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not start discount"); }
    finally { setSavingDiscount(false); }
  }
  async function stopDiscount() {
    setSavingDiscount(true);
    try {
      const { error } = await supabase.from("site_settings").upsert({ key: "global_discount_enabled", value: "false" }, { onConflict: "key" });
      if (error) throw error;
      await queryClient.invalidateQueries();
      setDiscountEnabled(false);
      toast.success("Discount stopped");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not stop discount"); }
    finally { setSavingDiscount(false); }
  }
  const logoQuery = useQuery({
    queryKey: ["site-logo-setting"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_settings").select("value").eq("key", "logo_url").maybeSingle();
      if (error) throw error;
      return data?.value ?? "";
    },
  });
  async function toggleMaintenance(enabled: boolean) {
    setSavingMaintenance(true);
    const previous = typeof window !== "undefined" ? window.localStorage.getItem("panelbazarbd_maintenance_mode") : null;
    // Update the same browser's cached gate immediately, so refresh reflects the admin's latest choice.
    if (typeof window !== "undefined") window.localStorage.setItem("panelbazarbd_maintenance_mode", enabled ? "true" : "false");
    try {
      const { error } = await supabase.from("site_settings").upsert({ key: "maintenance_mode", value: enabled ? "true" : "false" }, { onConflict: "key" });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["site_settings"] });
      toast.success(enabled ? "Maintenance mode enabled" : "Maintenance mode disabled — website is live");
    } catch (error) {
      if (typeof window !== "undefined") {
        if (previous === null) window.localStorage.removeItem("panelbazarbd_maintenance_mode");
        else window.localStorage.setItem("panelbazarbd_maintenance_mode", previous);
      }
      toast.error(error instanceof Error ? error.message : "Could not update maintenance mode");
    } finally {
      setSavingMaintenance(false);
    }
  }
  async function connectTelegram() {
    setConnectingTelegram(true);
    try {
      const result = await adminConnectTelegram();
      toast.success(`Telegram connected${result.bot ? `: @${result.bot}` : "!"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Telegram connection failed");
    } finally {
      setConnectingTelegram(false);
    }
  }
  async function uploadLogo(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("Logo must be smaller than 8 MB"); return; }
    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = "branding/" + crypto.randomUUID() + "." + ext;
      const { data, error } = await supabase.storage.from("product-images").upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (error) throw error;
      const url = supabase.storage.from("product-images").getPublicUrl(data.path).data.publicUrl;
      setLogoUrl(url);
      toast.success("Logo uploaded. Press Save logo to publish it.");
    } catch (error) {
      toast.error("Logo upload failed: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setUploadingLogo(false);
    }
  }
  async function saveLogo() {
    if (!logoUrl) { toast.error("Choose a logo image first"); return; }
    const { error } = await supabase.from("site_settings").upsert({ key: "logo_url", value: logoUrl }, { onConflict: "key" });
    if (error) { toast.error(error.message); return; }
    await queryClient.invalidateQueries();
    toast.success("Website logo updated");
  }
  const shownLogo = logoUrl || logoQuery.data || "";
  return (
    <div className="space-y-6">
      <AdminHeader title="Settings" description="Branding and contact shown on the website." />
      <section className="panel space-y-3 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-semibold">Website Maintenance Mode</h2>
            <p className="text-sm text-muted-foreground">When enabled, visitors will see the maintenance page. Admin accounts can still access and control the full website.</p>
          </div>
          <Switch
            checked={settings.maintenance_mode === "true"}
            disabled={savingMaintenance}
            onCheckedChange={(checked) => void toggleMaintenance(checked)}
            aria-label="Toggle website maintenance mode"
          />
        </div>
        <p className="text-sm font-medium">
          Status: {settings.maintenance_mode === "true" ? "ON — visitors see maintenance page" : "OFF — website is live"}
        </p>
      </section>
      <section className="panel space-y-3 p-4">
        <h2 className="font-semibold">Website logo</h2>
        <p className="text-sm text-muted-foreground">Choose the logo directly from your phone gallery. PNG, JPG, WEBP, GIF or AVIF, maximum 8 MB.</p>
        <Input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" disabled={uploadingLogo} onChange={(event) => { void uploadLogo(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
        {uploadingLogo && <p className="text-sm text-muted-foreground">Uploading logo…</p>}
        {shownLogo && <div className="flex items-center gap-3 rounded-lg border p-3"><img src={shownLogo} alt="Logo preview" className="h-16 w-16 rounded-lg object-contain" /><Button type="button" variant="ghost" onClick={() => setLogoUrl("")}>Choose another</Button></div>}
        <Button type="button" onClick={() => void saveLogo()} disabled={!logoUrl || uploadingLogo}>Save logo</Button>
      </section>
      <section className="panel space-y-2 p-4">
        <h2 className="font-semibold">Telegram notifications</h2>
        <p className="text-sm text-muted-foreground">After adding TELEGRAM_BOT_TOKEN and TELEGRAM_OWNER_CHAT_ID in Render, connect the bot webhook here.</p>
        <Button onClick={() => void connectTelegram()} disabled={connectingTelegram}>{connectingTelegram ? "Connecting…" : "Connect Telegram bot"}</Button>
      </section>
      <section className="panel space-y-4 p-4">
        <h2 className="font-semibold">Global Discount / Special Sale</h2>
        <p className="text-sm text-muted-foreground">Set a percentage and duration for a site-wide campaign. For example, 10% for 1 day (24 hours).</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">Discount percentage (%)<Input type="number" min="1" max="90" value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} /></label>
          <label className="space-y-1 text-sm">Duration (days)<Input type="number" min="1" max="30" value={discountDays} onChange={(e) => setDiscountDays(e.target.value)} /></label>
        </div>
        <p className="text-sm font-medium">Status: {discountEnabled ? "Active" : "Off"}</p>
        <div className="flex flex-wrap gap-2"><Button onClick={() => void startDiscount()} disabled={savingDiscount}>{savingDiscount ? "Saving…" : "Start discount"}</Button><Button variant="outline" onClick={() => void stopDiscount()} disabled={savingDiscount || !discountEnabled}>Stop discount</Button></div>
      </section>
      <h2 className="font-semibold">General</h2>
      <SettingsForm fields={[
        { key: "site_name", label: "Site name" },
        { key: "currency_symbol", label: "Currency symbol" },
        { key: "favicon_url", label: "Favicon URL" },
        { key: "primary_color", label: "Primary color", type: "color" },
        { key: "secondary_color", label: "Secondary color", type: "color" },
        { key: "site_description", label: "Site description", type: "textarea" },
      ]} />
      <h2 className="font-semibold">Contact</h2>
      <SettingsForm fields={[
        { key: "contact_phone", label: "Contact phone" },
        { key: "whatsapp_number", label: "WhatsApp number" },
        { key: "telegram_username", label: "Telegram username", hint: "Without @" },
        { key: "contact_email", label: "Email" },
      ]} />
      <h2 className="font-semibold">Footer</h2>
      <SettingsForm fields={[
        { key: "footer_text", label: "Footer description", type: "textarea" },
        { key: "footer_copyright", label: "Copyright text" },
      ]} />
    </div>
  );
}
