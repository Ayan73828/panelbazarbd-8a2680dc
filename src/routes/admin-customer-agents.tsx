import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CheckCheck, MessageCircle, RefreshCw, Send, UserRound, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Ticket = { id: string; user_id: string; subject: string; message: string; status: string; created_at: string };
type Reply = { id: string; ticket_id: string; user_id: string; message: string; created_at: string };

export const Route = createFileRoute("/admin-customer-agents")({ component: CustomerAgentInbox });

function CustomerAgentInbox() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [currentUser, setCurrentUser] = useState("");
  const [error, setError] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [replies, setReplies] = useState<Reply[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("আগে Login করুন।");
      setCurrentUser(auth.user.id);
      const { data: roles, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", auth.user.id);
      if (roleError) throw roleError;
      const permitted = (roles || []).some((r) => ["admin", "customer_agent"].includes(String(r.role).toLowerCase()));
      setAllowed(permitted);
      if (!permitted) throw new Error("এই ইনবক্স শুধু Admin ও Customer Agent role-এর জন্য।");
      const { data, error: ticketError } = await supabase.from("support_tickets").select("id,user_id,subject,message,status,created_at").eq("source", "customer_agent").order("created_at", { ascending: false }).limit(100);
      if (ticketError) throw ticketError;
      const rows = (data || []) as Ticket[];
      setTickets(rows);
      if ((!selectedId || !rows.some((row) => row.id === selectedId)) && rows.length) setSelectedId(rows[0].id);
    } catch (e) {
      setAllowed(false);
      setError(e instanceof Error ? e.message : "Customer Agent inbox লোড করা যায়নি।");
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  const loadReplies = useCallback(async (id: string) => {
    const { data, error: replyError } = await supabase.from("support_replies").select("id,ticket_id,user_id,message,created_at").eq("ticket_id", id).order("created_at", { ascending: true });
    if (replyError) { setError(replyError.message); return; }
    setReplies((data || []) as Reply[]);
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!allowed) return;
    const channel = supabase.channel("customer-agent-ticket-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, (payload) => {
        const row = payload.new as Ticket;
        if (row?.source !== "customer_agent") return;
        setTickets((current) => {
          const exists = current.some((ticket) => ticket.id === row.id);
          const next = exists ? current.map((ticket) => ticket.id === row.id ? { ...ticket, ...row } : ticket) : [row, ...current];
          return next.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        });
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [allowed]);
  useEffect(() => {
    if (!selectedId || !allowed) return;
    void loadReplies(selectedId);
    const channel = supabase.channel("customer-agent-inbox-" + selectedId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_replies", filter: "ticket_id=eq." + selectedId }, (payload) => {
        const row = payload.new as Reply;
        setReplies((prev) => prev.some((item) => item.id === row.id) ? prev : [...prev, row]);
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [selectedId, allowed, loadReplies]);

  const closeChat = async () => {
    if (!selected || selected.status !== "open" || closing) return;
    if (!window.confirm("এই Customer Agent chat বন্ধ করবেন? কাস্টমারকে email notification পাঠানো হবে।")) return;
    setClosing(true);
    setError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("আপনার login session শেষ হয়েছে। আবার Login করুন।");
      const response = await fetch("/api/admin/customer-agent-close", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ ticketId: selected.id }),
      });
      const result = await response.json() as { ok?: boolean; closed?: boolean; error?: string; emailSent?: boolean };
      if (!response.ok || !result.ok) throw new Error(result.error || "Chat বন্ধ করা যায়নি।");
      setTickets((rows) => rows.map((row) => row.id === selected.id ? { ...row, status: "closed" } : row));
      setError(result.emailSent ? "Chat বন্ধ হয়েছে এবং customer-কে email পাঠানো হয়েছে।" : "Chat বন্ধ হয়েছে। Email পাঠানো যায়নি—Resend sender/domain settings যাচাই করুন।");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat বন্ধ করা যায়নি।");
    } finally {
      setClosing(false);
    }
  };

  const selected = tickets.find((t) => t.id === selectedId);
  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || !selected || !currentUser || sending || selected.status !== "open") return;
    setSending(true);
    setError("");
    const { data, error: insertError } = await supabase.from("support_replies").insert({ ticket_id: selected.id, user_id: currentUser, message }).select("id,ticket_id,user_id,message,created_at").single();
    if (insertError) setError("রিপ্লাই পাঠানো যায়নি: " + insertError.message);
    else {
      setReplies((prev) => prev.some((item) => item.id === data.id) ? prev : [...prev, data as Reply]);
      setDraft("");
      // Important: sending a reply does NOT close the customer agent chat.
    }
    setSending(false);
  };

  return <main className="min-h-screen bg-background px-3 py-5 text-foreground sm:px-6"><div className="mx-auto max-w-6xl">
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="mb-1 flex items-center gap-2 text-sm text-muted-foreground"><UserRound className="h-4 w-4" /> Dedicated human support</p><h1 className="text-2xl font-bold">Customer Agent Inbox</h1><p className="text-sm text-muted-foreground">এখান থেকে customer-কে উত্তর দিন। রিপ্লাই পাঠালে chat open থাকবে।</p></div><button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" /> Refresh</button></header>
    {error && <div role="alert" className="mb-4 rounded-xl border border-destructive/30 p-3 text-sm">{error}</div>}
    {!allowed && !loading ? <div className="rounded-xl border border-border p-5 text-sm">Admin অথবা Customer Agent role প্রয়োজন।</div> : <div className="grid gap-4 md:grid-cols-[minmax(260px,0.85fr)_minmax(0,1.5fr)]">
      <section className="overflow-hidden rounded-xl border border-border"><div className="border-b border-border px-4 py-3 font-semibold">Agent chat requests ({tickets.length})</div><div className="max-h-[70vh] overflow-y-auto">{loading ? <p className="p-4 text-sm">Loading…</p> : tickets.length === 0 ? <p className="p-4 text-sm text-muted-foreground">এখনো কোনো Customer Agent request নেই।</p> : tickets.map((t) => <button key={t.id} onClick={() => setSelectedId(t.id)} className={"block w-full border-b border-border p-4 text-left " + (selectedId === t.id ? "bg-primary/10" : "hover:bg-muted/50")}><span className="block font-semibold">{t.subject || "Customer Agent Chat"}</span><span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">{t.message}</span><span className="mt-2 block text-[10px] text-muted-foreground">{new Date(t.created_at).toLocaleString()} · {t.status}</span></button>)}</div></section>
      <section className="flex min-h-[60vh] flex-col overflow-hidden rounded-xl border border-border">{selected ? <><div className="flex items-start justify-between gap-3 border-b border-border p-4"><div className="min-w-0"><h2 className="font-semibold">{selected.subject || "Customer Agent Chat"}</h2><p className="mt-1 break-all text-xs text-muted-foreground">Ticket: {selected.id}</p><p className="mt-2 whitespace-pre-wrap text-sm">{selected.message}</p><span className={"mt-2 inline-flex rounded-full px-2 py-1 text-xs " + (selected.status === "open" ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground")}>{selected.status === "open" ? "Active conversation" : "Closed"}</span></div>{selected.status === "open" && <button type="button" onClick={() => void closeChat()} disabled={closing} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-destructive/30 px-3 py-2 text-xs font-semibold text-destructive disabled:opacity-50"><XCircle className="h-4 w-4" />{closing ? "Closing…" : "Close chat"}</button>}</div><div className="flex-1 space-y-3 overflow-y-auto bg-muted/20 p-4">{replies.length === 0 ? <p className="text-sm text-muted-foreground">Customer-এর মেসেজ এলে এখানে দেখা যাবে।</p> : replies.map((r) => <div key={r.id} className={"flex " + (r.user_id === currentUser ? "justify-end" : "justify-start")}><div className={"max-w-[90%] rounded-2xl px-3 py-2 text-sm shadow-sm " + (r.user_id === currentUser ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-background border border-border")}><p className="mb-1 text-[10px] font-semibold opacity-75">{r.user_id === currentUser ? "You · Agent" : "Customer"}</p><p className="whitespace-pre-wrap">{r.message}</p><p className="mt-1 text-right text-[10px] opacity-70">{new Date(r.created_at).toLocaleString()}</p></div></div>)}</div>{selected.status === "open" ? <form onSubmit={send} className="flex gap-2 border-t border-border p-3"><input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} placeholder="Customer-কে উত্তর লিখুন…" className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-base" /><button disabled={!draft.trim() || sending} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Send className="h-4 w-4" /> Send</button></form> : <div className="border-t border-border p-3 text-sm text-muted-foreground">এই chat বন্ধ। রিপ্লাই পাঠিয়ে chat বন্ধ করা হয় না; বন্ধ করার জন্য Admin-এর ব্যবস্থা ব্যবহার করুন।</div>}</> : <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground"><MessageCircle className="mr-2 h-5 w-5" /> একটি Customer Agent chat নির্বাচন করুন</div>}</section>
    </div>}
  </div></main>;
}
