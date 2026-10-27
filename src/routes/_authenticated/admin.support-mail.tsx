import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AdminHeader, Loadable, useTable } from "@/components/admin/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { adminSendSupportEmail, adminSendSupportEmailAll } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/support-mail")({ component: AdminSupportMail });

function AdminSupportMail() {
  const { user } = useAuth();
  const users = useTable("profiles");
  const sendEmail = useServerFn(adminSendSupportEmail);
  const sendAllEmail = useServerFn(adminSendSupportEmailAll);
  const [to, setTo] = useState("");
  const [sendToAll, setSendToAll] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const profiles = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (users.data ?? []).filter((profile: any) =>
      profile.email && (!term || String(profile.email).toLowerCase().includes(term) ||
        String(profile.name ?? "").toLowerCase().includes(term) ||
        String(profile.username ?? "").toLowerCase().includes(term))
    ).slice(0, 30);
  }, [users.data, search]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (String(user?.email ?? "").toLowerCase() !== "ishak777998@gmail.com") {
      toast.error("Only the main admin can send Support Mail");
      return;
    }
    if (sendToAll && !window.confirm("Send this email to every website user with a registered email? This may take time and cannot be undone.")) return;
    setBusy(true);
    try {
      if (sendToAll) {
        const result = await sendAllEmail({ data: { subject, message } });
        toast.success(`Broadcast finished: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped (total ${result.total})`);
      } else {
        const result = await sendEmail({ data: { to, subject, message } });
        toast.success(`Email sent to ${result.to}`);
      }
      setSubject("");
      setMessage("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send email");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <AdminHeader title="Support Mail" description="Send an email to one address or the same email to all registered website users." />
      <section className="panel space-y-4 p-4">
        <div className="space-y-1">
          <h2 className="font-semibold">Find a website user</h2>
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search registered name, username, or email" />
        </div>
        <Loadable q={users}>
          {profiles.length ? <div className="max-h-56 space-y-1 overflow-y-auto">
            {profiles.map((profile: any) => (
              <button type="button" key={profile.id} onClick={() => setTo(String(profile.email))} className={`block w-full rounded-lg border p-2 text-left text-sm hover:bg-surface-2 ${to.toLowerCase() === String(profile.email).toLowerCase() ? "border-primary" : "border-border"}`}>
                <span className="block font-medium">{profile.name || profile.username || "Website user"}</span>
                <span className="block break-all text-xs text-muted-foreground">{profile.email}</span>
              </button>
            ))}
          </div> : <p className="text-sm text-muted-foreground">No matching registered users. You can still type any email address below.</p>}
        </Loadable>
      </section>
      <form onSubmit={(event) => void submit(event)} className="panel space-y-4 p-4">\n        <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm"><input type="checkbox" className="mt-1" checked={sendToAll} onChange={(event) => setSendToAll(event.target.checked)} /><span><strong>Send to all website users</strong><span className="mt-1 block text-xs text-muted-foreground">এক ক্লিকে একই ইমেইল সব registered website user-এর কাছে যাবে।</span></span></label>
        <div className="space-y-1.5">
          <label htmlFor="support-mail-to" className="text-sm font-medium">Recipient Gmail / email</label>
          <Input id="support-mail-to" type="email" required maxLength={254} value={to} onChange={(event) => setTo(event.target.value)} placeholder="customer@gmail.com" />
          <p className="text-xs text-muted-foreground">You can email people who have not registered yet too.</p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="support-mail-subject" className="text-sm font-medium">Subject</label>
          <Input id="support-mail-subject" required minLength={2} maxLength={200} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="About your Panel Bazar BD account" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="support-mail-message" className="text-sm font-medium">Message</label>
          <Textarea id="support-mail-message" required minLength={2} maxLength={10000} rows={8} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write your message here…" />
        </div>
        <p className="text-xs text-muted-foreground">The email is sent through the site's Resend setup. Never ask customers to share passwords or verification codes.</p>
        <Button type="submit" disabled={busy || String(user?.email ?? "").toLowerCase() !== "ishak777998@gmail.com" || (!sendToAll && !to.trim())} className="w-full">{busy ? (sendToAll ? "Sending to website users…" : "Sending email…") : sendToAll ? "Send to All Website Users" : "Send Support Mail"}</Button>
      </form>
    </div>
  );
}
