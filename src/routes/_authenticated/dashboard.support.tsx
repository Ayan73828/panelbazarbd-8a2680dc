import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/site/SiteLayout";
import { EmptyState, RowSkeleton } from "@/components/site/States";
import { SupportThread, StatusBadge } from "@/components/site/SupportThread";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { telegramNotifyEvent } from "@/lib/telegram-notifications.functions";

export const Route = createFileRoute("/_authenticated/dashboard/support")({
  head: () => ({ meta: [{ title: "Support — PANEL BAZAR BD" }, { name: "description", content: "Open a support ticket and chat with the admin." }] }),
  component: SupportPage,
});

function SupportPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const tickets = useQuery({
    queryKey: ["tickets", "mine", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("support_tickets").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const create = async () => {
    if (!user || !subject.trim() || !message.trim()) { toast.error("বিষয় ও মেসেজ লিখুন"); return; }
    setBusy(true);
    const { data: existing, error: existingError } = await supabase.from("support_tickets").select("id").eq("user_id", user.id).eq("status", "open").limit(1).maybeSingle();
    if (existingError) { setBusy(false); toast.error(existingError.message); return; }
    if (existing) { setBusy(false); toast.error("আপনার আগের টিকিটে admin উত্তর দেওয়া পর্যন্ত নতুন টিকিট করা যাবে না"); setOpenId(existing.id); return; }
    const { data, error } = await supabase.from("support_tickets").insert({ user_id: user.id, subject: subject.trim().slice(0, 150), message: message.trim().slice(0, 2000) }).select("id").single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setSubject(""); setMessage(""); setOpenId(data.id);
    void telegramNotifyEvent({ data: { event: "support", recordId: data.id } }).catch((notifyError) => console.error("Telegram support notification failed", notifyError));
    toast.success("টিকিট তৈরি হয়েছে");
    void qc.invalidateQueries({ queryKey: ["tickets"] });
  };
  return (
    <div className="space-y-6">
      <PageHeader title="Support" description="সমস্যা লিখুন, অ্যাডমিন এখানেই রিপ্লাই দেবে।" />
      <div className="panel space-y-3 p-4">
        <h2 className="font-semibold">নতুন টিকিট</h2>
        <Input placeholder="বিষয়" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} />
        <Textarea rows={4} placeholder="আপনার সমস্যা বিস্তারিত লিখুন" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} />
        <Button className="w-full" disabled={busy} onClick={create}>{busy ? "Sending…" : "Submit ticket"}</Button>
      </div>
      <div className="space-y-2">
        <h2 className="font-semibold">আমার টিকিট</h2>
        {tickets.isLoading ? <RowSkeleton /> : (tickets.data ?? []).length === 0 ? <EmptyState title="কোনো টিকিট নেই" /> : tickets.data!.map((t) => (
          <div key={t.id} className="panel p-3">
            <button className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setOpenId(openId === t.id ? null : t.id)}>
              <span className="truncate font-medium">{t.subject}</span>
              <StatusBadge status={t.status} />
            </button>
            {openId === t.id && <div className="mt-3"><SupportThread ticket={t} /></div>}
          </div>
        ))}
      </div>
    </div>
  );
}
