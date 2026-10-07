import { createFileRoute } from "@tanstack/react-router";
import { AdminHeader, SettingsForm } from "@/components/admin/kit";

export const Route = createFileRoute("/_authenticated/admin/settings")({ component: AdminSettings });

function AdminSettings() {
  return (
    <div className="space-y-6">
      <AdminHeader title="Settings" description="Branding, contact and payment numbers shown on the website." />
      <h2 className="font-semibold">Payment numbers</h2>
      <SettingsForm fields={[
        { key: "bkash_number", label: "bKash number" },
        { key: "nagad_number", label: "Nagad number" },
      ]} />
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
