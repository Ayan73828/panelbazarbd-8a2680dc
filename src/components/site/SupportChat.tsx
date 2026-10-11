import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, CheckCircle2, MessageCircle, Send, UserRound, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSite";
import { tgLink, waLink } from "@/lib/site";

type ChatMessage = { from: "bot" | "user" | "agent"; text: string; id?: string };
type ChatMode = "chooser" | "ai" | "agent";
type Flow = "issue" | "payment_details" | "expired_details" | "general_details" | "pending" | "done";
const agents = ["রাকিব", "মিরাজ", "মীরা", "মাহি"];
const greeting = (name: string) => `আসসালামু ওয়ালাইকুম! আমি ${name}, Panel Bazar BD-এর AI Support Assistant। আপনার কী সমস্যা হয়েছে, একটু দয়া করে বিস্তারিত খুলে বলুন।`;

function normalizeSupportText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[০-৯]/g, (digit) => String("০১২৩৪৫৬৭৮৯".indexOf(digit)))
    .replace(/[.,!?;:()[\]{}"'“”‘’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isGreetingOrTooVague(text: string): boolean {
  const value = normalizeSupportText(text);
  if (!value) return true;
  if (/^(hi|hello|hey|hii+|helo+|assalamu alaikum|salam|salaam|আসসালামু আলাইকুম|সালাম|হাই|হ্যালো|হ্যালো ভাই|ভাই|ভাইয়া|ভাইয়া|ok|okay|আচ্ছা|জি|হুম|hmm|hmm+|test|পরীক্ষা)$/.test(value)) return true;
  return value.length < 8;
}

function classifyIssue(text: string): "payment" | "expired" | "general" {
  const value = normalizeSupportText(text);

  // Check expiry first so phrases such as "panel er meyad sesh, payment diyechi"
  // are not incorrectly routed to the payment-not-received flow.
  const expiredPatterns = [
    /expire|expaird|expired|meyad|mead|miyad|ses ?hoye|date ses|panel bondho|panel kaj korche na|panel kaj kortese na|panel cholche na/,
    /এক্সপায়ার|এক্সপায়ার|মেয়াদ|মেয়াদ|মেয়াদোত্তীর্ণ|মেয়াদ শেষ|মেয়াদ শেষ|মেয়াদ শেষ হয়ে|মেয়াদ sesh|বন্ধ হয়ে গেছে|বন্ধ হয়ে গেছে/
  ];
  if (expiredPatterns.some((pattern) => pattern.test(value))) return "expired";

  const paymentPatterns = [
    /payment|pay ?ment|deposit|add balance|balance add|recharge|top ?up|trx ?id|transaction|trans ?id|bkash|bikash|nagad|rocket|upay|send money|cash ?in/,
    /tk kete|taka kete|taka path|tk path|taka dei|tk disi|tk diyechi|payment kori|pay kor|balance ashe nai|balance ase nai|balance add hoy nai|tk add hoy nai|taka pai nai|tk pai nai|payment hoy nai|payment ashe nai|payment ase nai|money pai nai|taka dhuke nai/,
    /পেমেন্ট|টাকা|টাকা কেটে|টাকা পাঠ|টাকা দিয়েছি|টাকা দিয়েছি|পাইনি|পাই নি|পায়নি|পায়নি|হয়নি|হয়নি|ট্রানজ্যাকশন|বিকাশ|নগদ|রকেট|ব্যালেন্স|ডিপোজিট|রিচার্জ|ক্যাশ ইন/
  ];
  if (paymentPatterns.some((pattern) => pattern.test(value))) return "payment";
  return "general";
}

export function SupportChat() {
  const { settings } = useSettings();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ChatMode>("chooser");
  const [agentTicketId, setAgentTicketId] = useState<string | null>(null);
  const [agentStarting, setAgentStarting] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [flow, setFlow] = useState<Flow>("issue");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [agent] = useState(() => agents[Math.floor(Math.random() * agents.length)] || "রাকিব");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTicketRef = useRef<{ subject: string; message: string } | null>(null);
  const primeReplySound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = audioContextRef.current || new AudioContextClass();
      audioContextRef.current = context;
      if (context.state === "suspended") void context.resume();
    } catch {
      // Audio is optional; some browsers may block it.
    }
  };

  const playPremiumReplySound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = audioContextRef.current || new AudioContextClass();
      audioContextRef.current = context;
      if (context.state === "suspended") void context.resume();
      const now = context.currentTime;
      // A soft, premium two-note chime; no external audio file or download required.
      [659.25, 987.77].forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, now + index * 0.11);
        gain.gain.setValueAtTime(0.0001, now + index * 0.11);
        gain.gain.exponentialRampToValueAtTime(0.12, now + index * 0.11 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.11 + 0.32);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now + index * 0.11);
        oscillator.stop(now + index * 0.11 + 0.34);
      });
    } catch {
      // Browsers may block audio until the visitor interacts with the page.
    }
  };

  const startHumanAgent = async () => {
    primeReplySound();
    if (!user?.id) {
      setMessages([{ from: "bot", text: "সরাসরি Customer Agent-এর সঙ্গে কথা বলতে আগে Login করুন। এরপর আবার Customer Agent নির্বাচন করুন।" }]);
      setMode("agent");
      return;
    }
    setAgentStarting(true);
    try {
      const { data, error } = await supabase.from("support_tickets").insert({
        user_id: user.id,
        subject: "Live Customer Agent Chat",
        message: "Customer requested a live human support chat.",
        source: "customer",
        status: "open",
      }).select("id").single();
      if (error || !data?.id) throw error || new Error("Could not create support ticket");
      setAgentTicketId(data.id);
      setMode("agent");
      setMessages([{ from: "agent", text: "আপনার Customer Agent chat request তৈরি হয়েছে। একজন এজেন্ট উত্তর দিলে এখানে দেখা যাবে।" }]);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (accessToken) {
          const notifyResponse = await fetch("/api/public/support/agent-notify", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({ ticketId: data.id }),
          });
          if (!notifyResponse.ok) {
            setMessages((current) => [...current, { from: "agent", text: "আপনার chat request ওয়েবসাইটে তৈরি হয়েছে, তবে Telegram agent notification এখনো configure করা নেই বা পাঠানো যায়নি।" }]);
          }
        }
      } catch {
        setMessages((current) => [...current, { from: "agent", text: "Chat request তৈরি হয়েছে, কিন্তু agent notification পাঠানো যায়নি।" }]);
      }
    } catch {
      setMessages([{ from: "agent", text: "Customer Agent request তৈরি করা যায়নি। অনুগ্রহ করে Login আছে কি না দেখুন, তারপর আবার চেষ্টা করুন অথবা Normal Support ব্যবহার করুন।" }]);
      setMode("agent");
    } finally {
      setAgentStarting(false);
    }
  };

  useEffect(() => {
    if (mode !== "agent" || !agentTicketId || !user?.id) return;
    let active = true;
    void supabase.from("support_replies")
      .select("id,user_id,message")
      .eq("ticket_id", agentTicketId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!active || !data) return;
        setMessages((current) => {
          const known = new Set(current.map((message) => message.id).filter(Boolean));
          const incoming = data
            .filter((row) => row.user_id !== user.id && !known.has(row.id))
            .map((row) => ({ from: "agent" as const, text: row.message, id: row.id }));
          if (incoming.length) playPremiumReplySound();
          return [...current, ...incoming];
        });
      });
    const channel = supabase
      .channel(`support-agent-${agentTicketId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "support_replies",
        filter: `ticket_id=eq.${agentTicketId}`,
      }, (payload) => {
        const row = payload.new as { id: string; user_id: string; message: string };
        if (row.user_id !== user.id) {
          setMessages((current) => [...current, { from: "agent", text: row.message, id: row.id }]);
          playPremiumReplySound();
        }
      })
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [mode, agentTicketId, user?.id]);
  
  const sendAgentMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || !agentTicketId || !user?.id || busy) return;
    primeReplySound();
    setText("");
    setBusy(true);
    const { error } = await supabase.from("support_replies").insert({
      ticket_id: agentTicketId,
      user_id: user.id,
      message: value,
    });
    if (error) {
      setMessages((current) => [...current, { from: "agent", text: "মেসেজ পাঠানো যায়নি। আবার চেষ্টা করুন।" }]);
      setText(value);
    } else {
      setMessages((current) => [...current, { from: "user", text: value }]);
    }
    setBusy(false);
  };

  const wa = waLink(settings.whatsapp_number, `Hello ${settings.site_name}, I need support.`);
  const tg = tgLink(settings.telegram_username);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, open, mode]);

  useEffect(() => {
    if (flow !== "pending") return;
    timeoutRef.current = setTimeout(async () => {
      const ticket = pendingTicketRef.current;
      if (user?.id && ticket) {
        const { error } = await supabase.from("support_tickets").insert({
          user_id: user.id,
          subject: ticket.subject,
          message: ticket.message,
          source: "website_ai_timeout",
          status: "open",
        });
        setMessages((current) => [...current, { from: "bot", text: error
          ? "৫ মিনিট পার হওয়ায় চ্যাটটি বন্ধ করা হয়েছে, তবে Support Request জমা হয়নি। অনুগ্রহ করে Normal Support-এ যোগাযোগ করুন।"
          : "৫ মিনিটের মধ্যে সমাধান না হওয়ায় চ্যাটটি বন্ধ করা হয়েছে এবং আপনার ID দিয়ে Support Request অ্যাডমিনের কাছে তৈরি করা হয়েছে।" }]);
      } else {
        setMessages((current) => [...current, { from: "bot", text: "৫ মিনিটের মধ্যে সমাধান না হওয়ায় চ্যাটটি বন্ধ করা হয়েছে। Support Request তৈরি করতে অনুগ্রহ করে Login করুন, অথবা Normal Support-এ যোগাযোগ করুন।" }]);
      }
      pendingTicketRef.current = null;
      setFlow("done");
      setOpen(false);
    }, 5 * 60 * 1000);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [flow, user?.id]);

  const startAI = () => {
    setMode("ai");
    setFlow("issue");
    setMessages([{ from: "bot", text: greeting(agent) }]);
  };

  const resetChat = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setMode("chooser");
    setAgentTicketId(null);
    setFlow("issue");
    setMessages([]);
    setText("");
    setBusy(false);
  };

  const submitMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || busy || flow === "done" || flow === "pending") return;
    // Prime audio during the user's tap so iOS Safari can play the later reply chime.
    primeReplySound();
    setText("");
    setBusy(true);
    const nextMessages: ChatMessage[] = [...messages, { from: "user", text: value }];
    setMessages(nextMessages);

    try {
      const response = await fetch("/api/public/support/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentName: agent,
          messages: nextMessages.map((message) => ({
            role: message.from === "bot" ? "assistant" : "user",
            content: message.text,
          })),
        }),
      });
      const result = await response.json() as {
        reply?: string;
        error?: string;
        category?: "payment" | "expired" | "general";
        readyForTicket?: boolean;
        subject?: string;
        ticketMessage?: string;
      };
      if (!response.ok || !result.reply) {
        setMessages((current) => [...current, { from: "bot", text: result.error || "দুঃখিত, AI Support এখন উত্তর দিতে পারছে না। একটু পরে আবার চেষ্টা করুন অথবা Normal Support ব্যবহার করুন।" }]);
        return;
      }

      setMessages((current) => [...current, { from: "bot", text: result.reply! }]);
      playPremiumReplySound();
      if (result.readyForTicket) {
        if (!user?.id) {
          setFlow("done");
          setMessages((current) => [...current, { from: "bot", text: "Support Request তৈরি করার আগে অনুগ্রহ করে Login করুন। আপনার তথ্য কপি করে Normal Support-এ পাঠাতে পারেন।" }]);
          return;
        }
        const ticketMessage = (result.ticketMessage || nextMessages.map((message) => `${message.from === "user" ? "Customer" : "Assistant"}: ${message.text}`).join("\n")).slice(0, 5000);
        pendingTicketRef.current = {
          subject: result.subject || "AI Support Request",
          message: ticketMessage,
        };
        setFlow("pending");
        setMessages((current) => [...current, { from: "bot", text: "আপনার তথ্য নেওয়া হয়েছে। ৫ মিনিটের মধ্যে সমাধান না হলে আপনার ID দিয়ে Support Request তৈরি হবে।" }]);
      }
    } catch {
      setMessages((current) => [...current, { from: "bot", text: "ইন্টারনেট বা সার্ভারের সমস্যার কারণে উত্তর আনা যায়নি। আবার চেষ্টা করুন অথবা Normal Support ব্যবহার করুন।" }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-24 right-4 left-auto z-50 flex flex-col items-end gap-2">
        <button type="button" onClick={() => setOpen((value) => !value)} aria-label="Open support chat" className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl ring-4 ring-background/80 transition-transform hover:scale-105">
          {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        </button>
        {!open && <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold shadow-lg">Support Chat</span>}
      </div>

      {open && <section className="fixed bottom-24 right-4 left-auto z-50 flex max-h-[min(65vh,560px)] w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl" aria-label="Support chat">
        <header className="flex items-center justify-between gap-3 bg-primary px-3 py-2.5 text-primary-foreground">
          <div className="flex items-center gap-2"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15"><Bot className="h-5 w-5" /></span><div><p className="font-semibold">Support Center</p><p className="text-xs opacity-85">AI assistant & human support</p></div></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close support chat" className="rounded-full p-2 hover:bg-white/15"><X className="h-5 w-5" /></button>
        </header>

        {mode === "chooser" ? <div className="space-y-3 p-4">
          <p className="text-sm text-muted-foreground">আপনি কীভাবে সাপোর্ট নিতে চান?</p>
          <button type="button" onClick={startAI} className="flex w-full items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-left transition-colors hover:bg-primary/10">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary"><Bot className="h-6 w-6" /></span><span><span className="block font-semibold">AI Support</span><span className="block text-xs text-muted-foreground">চ্যাটে সমস্যার তথ্য দিন</span></span>
          </button>
          <button type="button" onClick={() => void startHumanAgent()} disabled={agentStarting} className="flex w-full items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-left transition-colors hover:bg-emerald-500/10 disabled:opacity-60"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600"><UserRound className="h-6 w-6" /></span><span><span className="block font-semibold">{agentStarting ? "Connecting…" : "Customer Agent"}</span><span className="block text-xs text-muted-foreground">মানুষের সঙ্গে সরাসরি চ্যাট করুন (Login required)</span></span></button>
          <div className="rounded-xl border border-border p-4"><div className="mb-3 flex items-center gap-2"><UserRound className="h-5 w-5" /><span className="font-semibold">Normal Support</span></div><div className="grid grid-cols-2 gap-2">
            {wa && <a href={wa} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-lg bg-success px-3 py-3 text-sm font-semibold text-background"><MessageCircle className="h-4 w-4" /> WhatsApp</a>}
            {tg && <a href={tg} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-3 text-sm font-semibold text-accent-foreground"><Send className="h-4 w-4" /> Telegram</a>}
            {!wa && !tg && <p className="col-span-2 text-xs text-muted-foreground">Admin Panel থেকে WhatsApp/Telegram contact সেট করতে হবে।</p>}
          </div></div>
        </div> : mode === "agent" ? <>
          <div className="flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
            <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-[11px] text-muted-foreground">Customer Agent Chat {agentTicketId ? "• Request: " + agentTicketId.slice(0, 8) : ""}</div>
            {messages.map((message, index) => <div key={message.id || index} className={`flex ${message.from === "user" ? "justify-end" : "justify-start"}`}><p className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${message.from === "user" ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted text-foreground"}`}>{message.text}</p></div>)}
            <div ref={bottomRef} />
          </div>
          {agentTicketId ? <form onSubmit={sendAgentMessage} className="flex items-center gap-2 border-t border-border p-3"><input value={text} onChange={(event) => setText(event.target.value)} placeholder="এজেন্টকে মেসেজ লিখুন…" maxLength={2000} className="min-w-0 flex-1 rounded-full border border-input bg-background px-4 py-2.5 text-base outline-none focus:ring-2 focus:ring-primary" aria-label="Message customer agent" /><button type="submit" disabled={!text.trim() || busy} aria-label="Send message to agent" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"><Send className="h-4 w-4" /></button></form> : <div className="border-t border-border p-3"><button type="button" onClick={resetChat} className="w-full rounded-lg border border-border px-3 py-2 text-sm font-semibold">Back to Support options</button></div>}
          <button type="button" onClick={resetChat} className="border-t border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground">← Support options</button>
        </> : <>
          <div className="flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
            <div className="rounded-lg bg-muted/70 px-3 py-2 text-[11px] text-muted-foreground">আপনি AI Support Assistant-এর সঙ্গে কথা বলছেন।</div>
            {messages.map((message, index) => <div key={index} className={`flex ${message.from === "user" ? "justify-end" : "justify-start"}`}><p className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${message.from === "user" ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted text-foreground"}`}>{message.text}</p></div>)}
            {busy && <div className="flex justify-start" role="status" aria-label="AI is typing"><div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-muted px-4 py-3 text-muted-foreground"><span className="sr-only">উত্তর তৈরি হচ্ছে</span><span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" /><span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" /><span className="h-2 w-2 animate-bounce rounded-full bg-current" /></div></div>}<div ref={bottomRef} />
          </div>
          {flow === "done" ? <div className="space-y-2 border-t border-border p-3">
            <div className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4" /> কথোপকথন সম্পন্ন</div>
            <button type="button" onClick={resetChat} className="w-full rounded-lg border border-border px-3 py-2 text-sm font-semibold">Back to Support options</button>
            <div className="grid grid-cols-2 gap-2">{wa && <a href={wa} target="_blank" rel="noreferrer" className="rounded-lg bg-success px-3 py-2 text-center text-sm font-semibold text-background">WhatsApp</a>}{tg && <a href={tg} target="_blank" rel="noreferrer" className="rounded-lg bg-accent px-3 py-2 text-center text-sm font-semibold text-accent-foreground">Telegram</a>}</div>
          </div> : flow === "pending" ? <div className="space-y-2 border-t border-border p-3"><p className="text-sm text-muted-foreground">৫ মিনিটের মধ্যে সমাধান না হলে আপনার Support Request তৈরি হবে। আপাতত চ্যাট খোলা রাখুন।</p><button type="button" onClick={() => setOpen(false)} className="w-full rounded-lg border border-border px-3 py-2 text-sm font-semibold">চ্যাট মিনিমাইজ করুন</button></div> : <form onSubmit={submitMessage} className="flex items-center gap-2 border-t border-border p-3">
            <input value={text} onChange={(event) => setText(event.target.value)} placeholder="আপনার মেসেজ লিখুন…" maxLength={2000} className="min-w-0 flex-1 rounded-full border border-input bg-background px-4 py-2.5 text-base outline-none focus:ring-2 focus:ring-primary" aria-label="Your message" />
            <button type="submit" disabled={!text.trim() || busy} aria-label="Send message" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"><Send className="h-4 w-4" /></button>
          </form>}
          {flow !== "pending" && <button type="button" onClick={resetChat} className="border-t border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground">← Support options</button>}
        </>}
      </section>}
    </>
  );
}
