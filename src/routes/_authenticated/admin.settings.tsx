import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adminConnectTelegram } from "@/lib/admin.functions";
import { AdminHeader, SettingsForm } from "@/components/admin/kit";

export const Route = createFileRoute("/_authenticated/admin/settings")({ component: AdminSettings });

function AdminSettings() {
  const [connectingTelegram, setConnectingTelegram] = useState(false);
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
  return (
    <div className="space-y-6">
      <AdminHeader title="Settings" description="Branding and contact shown on the website." />
      <section className="panel space-y-2 p-4">
        <h2 className="font-semibold">Telegram notifications</h2>
        <p className="text-sm text-muted-foreground">After adding TELEGRAM_BOT_TOKEN and TELEGRAM_OWNER_CHAT_ID in Render, connect the bot webhook here.</p>
        <Button onClick={() => void connectTelegram()} disabled={connectingTelegram}>{connectingTelegram ? "Connecting…" : "Connect Telegram bot"}</Button>
      </section>
      <h2 className="font-semibold">General</h2>
      <SettingsForm fields={[
        { key: "site_name", label: "Site name" },
        { key: "currency_symbol", label: "Currency symbol" },
        { key: "logo_url", label: "Logo URL", hint: "Paste an image link" },
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
