import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { MessageCircle, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Ticket = {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
};
type Reply = { id: string; ticket_id: string; user_id: string; message: string; created_at: string };

export const Route = createFileRoute("/admin-support")({ component: AdminSupportPage });

function AdminSupportPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [replies, setReplies] = useState<Reply[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [adminId, setAdminId] = useState("");

  const loadTickets = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        setIsAdmin(false);
        setError("অ্যাডমিন সাপোর্ট দেখতে আগে অ্যাডমিন অ্যাকাউন্টে Login করুন।");
        return;
      }
      setAdminId(authData.user.id);
      const { data: roleRows, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authData.user.id);
      if (roleError) throw roleError;
      const allowed = (roleRows || []).some((row) => String(row.role).toLowerCase() === "admin");
      setIsAdmin(allowed);
      if (!allowed) {
        setError("এই পেজটি শুধু অ্যাডমিন ব্যবহার করতে পারবেন।");
        return;
      }
      const { data, error: ticketsError } = await supabase
        .from("support_tickets")
        .select("id,user_id,subject,message,status,created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (ticketsError) throw ticketsError;
      const rows = (data || []) as Ticket[];
      setTickets(rows);
      if (!selectedId && rows.length) setSelectedId(rows[0].id);
      if (selectedId && !rows.some((row) => row.id === selectedId) && rows.length) setSelectedId(rows[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Support request লোড করা যায়নি। Supabase admin access/RLS পরীক্ষা করুন।");
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  const loadReplies = useCallback(async (ticketId: string) => {
    const { data, error: replyError } = await supabase
      .from("support_replies")
      .select("id,ticket_id,user_id,message,created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    if (replyError) {
      setError(replyError.message);
      return;
    }
    setReplies((data || []) as Reply[]);
  }, []);

  useEffect(() => { void loadTickets(); }, [loadTickets]);
  useEffect(() => {
    if (!selectedId || !isAdmin) return;
    void loadReplies(selectedId);
    const channel = supabase.channel("admin-support-replies-" + selectedId)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "support_replies",
        filter: "ticket_id=eq." + selectedId,
      }, (payload) => {
        const row = payload.new as Reply;
        setReplies((current) => current.some((item) => item.id === row.id) ? current : [...current, row]);
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [selectedId, isAdmin, loadReplies]);

  const selected = tickets.find((ticket) => ticket.id === selectedId);

  const sendReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || !selected || !adminId || sending) return;
    setSending(true);
    setError("");
    const { data, error: insertError } = await supabase.from("support_replies").insert({
      ticket_id: selected.id,
      user_id: adminId,
      message,
    }).select("id,ticket_id,user_id,message,created_at").single();
    if (insertError) {
      setError("উত্তর পাঠানো যায়নি: " + insertError.message + " — Supabase support_replies-এর admin INSERT policy পরীক্ষা করুন।");
    } else {
      setReplies((current) => current.some((item) => item.id === data.id) ? current : [...current, data as Reply]);
      setDraft("");
      if (selected.status !== "closed") {
        await supabase.from("support_tickets").update({ status: "in_progress" }).eq("id", selected.id);
        setTickets((current) => current.map((ticket) => ticket.id === selected.id ? { ...ticket, status: "in_progress" } : ticket));
      }
    }
    setSending(false);
  };

  return (
    <main className="min-h-screen bg-background px-3 py-5 text-foreground sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div><div className="mb-1 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /><span className="text-sm text-muted-foreground">Panel Bazar BD</span></div><h1 className="text-2xl font-bold">Customer Support Inbox</h1><p className="text-sm text-muted-foreground">ওয়েবসাইট থেকেই গ্রাহকের মেসেজের উত্তর দিন।</p></div>
          <button onClick={() => void loadTickets()} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium"><RefreshCw className="h-4 w-4" /> Refresh</button>
        </header>
        {error && <div role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">{error}</div>}
        {!isAdmin && !loading ? <div className="rounded-xl border border-border p-6 text-sm">{error || "Admin permission required."}</div> : <div className="grid gap-4 md:grid-cols-[minmax(260px,0.85fr)_minmax(0,1.5fr)]">
          <section className="overflow-hidden rounded-xl border border-border">
            <div className="border-b border-border px-4 py-3 font-semibold">Support requests <span className="ml-1 text-sm text-muted-foreground">({tickets.length})</span></div>
            <div className="max-h-[70vh] overflow-y-auto">
              {loading ? <p className="p-4 text-sm text-muted-foreground">Loading…</p> : tickets.length === 0 ? <p className="p-4 text-sm text-muted-foreground">কোনো Support Request পাওয়া যায়নি।</p> : tickets.map((ticket) => <button key={ticket.id} onClick={() => setSelectedId(ticket.id)} className={"block w-full border-b border-border p-4 text-left last:border-0 " + (selectedId === ticket.id ? "bg-primary/10" : "hover:bg-muted/60")}>
                <div className="mb-1 flex items-center justify-between gap-2"><span className="line-clamp-1 font-semibold">{ticket.subject || "Support request"}</span><span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px]">{ticket.status}</span></div>
                <p className="line-clamp-2 text-xs text-muted-foreground">{ticket.message}</p><p className="mt-2 text-[10px] text-muted-foreground">{new Date(ticket.created_at).toLocaleString()}</p>
              </button>)}
            </div>
          </section>
          <section className="flex min-h-[60vh] flex-col overflow-hidden rounded-xl border border-border">
            {selected ? <>
              <div className="border-b border-border p-4"><h2 className="font-semibold">{selected.subject || "Support request"}</h2><p className="mt-1 break-all text-xs text-muted-foreground">Ticket: {selected.id}</p><p className="mt-2 whitespace-pre-wrap text-sm">{selected.message}</p></div>
              <div className="flex-1 space-y-3 overflow-y-auto bg-muted/20 p-4">
                {replies.length === 0 ? <p className="text-sm text-muted-foreground">এখনো কোনো রিপ্লাই নেই। নিচে উত্তর লিখুন।</p> : replies.map((reply) => <div key={reply.id} className={"flex " + (reply.user_id === adminId ? "justify-end" : "justify-start")}><div className={"max-w-[90%] rounded-xl px-3 py-2 text-sm " + (reply.user_id === adminId ? "bg-primary text-primary-foreground" : "bg-muted")}><p className="mb-1 text-[10px] font-semibold opacity-75">{reply.user_id === adminId ? "Admin reply" : "Customer message"}</p><p className="whitespace-pre-wrap">{reply.message}</p><p className="mt-1 text-right text-[10px] opacity-70">{new Date(reply.created_at).toLocaleString()}</p></div></div>)}
              </div>
              <form onSubmit={sendReply} className="flex gap-2 border-t border-border p-3"><input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} placeholder="গ্রাহককে উত্তর লিখুন…" className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-base" /><button disabled={!draft.trim() || sending} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Send className="h-4 w-4" /> Send</button></form>
            </> : <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground"><MessageCircle className="mr-2 h-5 w-5" /> একটি Support Request নির্বাচন করুন</div>}
          </section>
        </div>}
      </div>
    </main>
  );
}
