import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Ticket = { id: string; user_id: string; subject: string; message: string; status: string; created_at: string };

export function SupportThread({ ticket, admin }: { ticket: Ticket; admin?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const replies = useQuery({
    queryKey: ["ticket-replies", ticket.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("support_replies").select("*").eq("ticket_id", ticket.id).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
  const send = async () => {
    if (!text.trim() || !user) return;
    setBusy(true);
    const { error } = await supabase.from("support_replies").insert({ ticket_id: ticket.id, user_id: user.id, message: text.trim().slice(0, 2000) });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setText("");
    if (admin) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) throw new Error("Admin login session expired.");
        const response = await fetch("/api/public/support/close-ticket", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ ticketId: ticket.id }),
        });
        const result = await response.json() as { ok?: boolean; emailSent?: boolean; error?: string };
        if (!response.ok || !result.ok) throw new Error(result.error || "Could not close ticket.");
        toast.success(result.emailSent ? "রিপ্লাই পাঠানো হয়েছে, টিকিট বন্ধ এবং customer-কে email করা হয়েছে" : "রিপ্লাই পাঠানো হয়েছে ও টিকিট বন্ধ হয়েছে; email পাঠানো যায়নি");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Reply পাঠানো হয়েছে, তবে ticket close/email notification হয়নি।");
      }
      void qc.invalidateQueries({ queryKey: ["tickets"] });
    }
    void qc.invalidateQueries({ queryKey: ["ticket-replies", ticket.id] });
  };
  const setStatus = async (status: string) => {
    if (admin && (status === "resolved" || status === "closed")) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) throw new Error("Admin login session expired.");
        const response = await fetch("/api/public/support/close-ticket", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ ticketId: ticket.id }),
        });
        const result = await response.json() as { ok?: boolean; emailSent?: boolean; error?: string };
        if (!response.ok || !result.ok) throw new Error(result.error || "Could not close ticket.");
        toast.success(result.emailSent ? "Ticket বন্ধ; customer email notification পাঠানো হয়েছে" : "Ticket বন্ধ হয়েছে, কিন্তু email পাঠানো যায়নি");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Ticket close করা যায়নি");
        return;
      }
    } else {
      const { error } = await supabase.from("support_tickets").update({ status }).eq("id", ticket.id);
      if (error) { toast.error(error.message); return; }
    }
    void qc.invalidateQueries({ queryKey: ["tickets"] });
  };
  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-surface-2 p-3 text-sm">
        <p className="whitespace-pre-wrap break-words">{ticket.message}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{new Date(ticket.created_at).toLocaleString()}</p>
      </div>
      {(replies.data ?? []).map((r) => {
        const mine = r.user_id === ticket.user_id;
        return (
          <div key={r.id} className={`rounded-lg p-3 text-sm ${mine ? "bg-surface-2" : "ml-6 bg-primary/10"}`}>
            <p className="text-[11px] font-semibold text-muted-foreground">{mine ? "Customer" : "Support"}</p>
            <p className="whitespace-pre-wrap break-words">{r.message}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
          </div>
        );
      })}
      {ticket.status === "open" ? (
        <div className="space-y-2">
          <Textarea rows={3} placeholder="রিপ্লাই লিখুন…" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
          <div className="flex gap-2">
            <Button className="flex-1" disabled={busy || !text.trim()} onClick={send}>{busy ? "Sending…" : "Send reply"}</Button>
            {admin && <Button variant="secondary" onClick={() => setStatus("resolved")}>Close</Button>}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-lg border border-border p-3 text-sm text-muted-foreground">
          টিকিটটি বন্ধ করা হয়েছে।
          {admin && <Button size="sm" variant="secondary" onClick={() => setStatus("open")}>Reopen</Button>}
        </div>
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status === "open" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{status === "open" ? "Open" : "Closed"}</span>;
}
