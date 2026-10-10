import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, CheckCircle2, MessageCircle, Send, UserRound, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSite";
import { tgLink, waLink } from "@/lib/site";

type ChatMessage = { from: "bot" | "user"; text: string };
type Flow = "issue" | "payment_details" | "expired_details" | "general_details" | "pending" | "done";
const agents = ["রাকিব", "মিরাজ", "মীরা", "মাহি"];
const greeting = (name: string) => `আসসালামু ওয়ালাইকুম! আমি ${name}, Panel Bazar BD-এর AI Support Assistant। আপনার কী সমস্যা হয়েছে, একটু দয়া করে বিস্তারিত খুলে বলুন।`;

function classifyIssue(text: string): "payment" | "expired" | "general" {
  const value = text.toLowerCase();
  if (/payment|পেমেন্ট|টাকা|পাইনি|হয়নি|হয়নি|ট্রানজ্যাকশন|transaction|trx|বিকাশ|নগদ|রকেট|add balance|deposit/.test(value)) return "payment";
  if (/expired|expire|expaird|এক্সপায়ার|এক্সপায়ার|মেয়াদ|মেয়াদ|মেয়াদোত্তীর্ণ/.test(value)) return "expired";
  return "general";
}

export function SupportChat() {
  const { settings } = useSettings();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"chooser" | "ai">("chooser");
  const [flow, setFlow] = useState<Flow>("issue");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [agent] = useState(() => agents[Math.floor(Math.random() * agents.length)] || "রাকিব");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wa = waLink(settings.whatsapp_number, `Hello ${settings.site_name}, I need support.`);
  const tg = tgLink(settings.telegram_username);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, open, mode]);

  useEffect(() => {
    if (flow !== "pending") return;
    timeoutRef.current = setTimeout(() => {
      setMessages((current) => [...current, { from: "bot", text: "৫ মিনিটের মধ্যে সমাধান নিশ্চিত না হওয়ায় চ্যাটটি বন্ধ করা হয়েছে। আপনার Support Request অ্যাডমিনের কাছে জমা আছে।" }]);
      setFlow("done");
      setOpen(false);
    }, 5 * 60 * 1000);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [flow]);

  const startAI = () => {
    setMode("ai");
    setFlow("issue");
    setMessages([{ from: "bot", text: greeting(agent) }]);
  };

  const resetChat = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setMode("chooser");
    setFlow("issue");
    setMessages([]);
    setText("");
    setBusy(false);
  };

  const submitMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || busy || flow === "done" || flow === "pending") return;
    setText("");
    setMessages((current) => [...current, { from: "user", text: value }]);

    if (flow === "issue") {
      const kind = classifyIssue(value);
      if (kind === "payment") {
        setFlow("payment_details");
        setMessages((current) => [...current, { from: "bot", text: "বুঝতে পেরেছি। Kindly আপনি যে নম্বর থেকে টাকা পাঠিয়েছেন, সেই নম্বরটি এবং Transaction ID (TrxID) এখানে দিন।" }]);
      } else if (kind === "expired") {
        setFlow("expired_details");
        setMessages((current) => [...current, { from: "bot", text: "বুঝতে পেরেছি। আপনার প্যানেলের নাম এবং Order ID-টি এখানে দিন, দয়া করে।" }]);
      } else {
        setFlow("general_details");
        setMessages((current) => [...current, { from: "bot", text: "সমস্যাটি বুঝতে সাহায্য করার জন্য প্যানেলের নাম, Order ID (থাকলে) এবং কী ঘটেছে—এই তথ্যগুলো বিস্তারিত লিখুন।" }]);
      }
      return;
    }

    const kind = flow === "payment_details" ? "payment" : flow === "expired_details" ? "expired" : "general";
    const subject = kind === "payment" ? "AI Support: Payment not received" : kind === "expired" ? "AI Support: Expired panel/order" : "AI Support: General issue";
    const firstIssue = messages.find((message) => message.from === "user")?.text ?? "Support request";
    const fullMessage = `Issue: ${firstIssue}\nCustomer details: ${value}\nCollected by: ${agent} (AI Support Assistant)`;
    setBusy(true);

    if (!user?.id) {
      setBusy(false);
      setFlow("done");
      setMessages((current) => [...current,
        { from: "bot", text: "ধন্যবাদ। নিরাপদে আপনার সমস্যাটি অ্যাডমিনের কাছে পাঠাতে অনুগ্রহ করে আগে Login করুন। আপাতত Normal Support থেকে WhatsApp বা Telegram-এ যোগাযোগ করতে পারেন।" },
        { from: "bot", text: `আপনার দেওয়া তথ্য (কপি করে পাঠাতে পারেন):\n${fullMessage}` },
      ]);
      return;
    }

    const { error } = await supabase.from("support_tickets").insert({
      user_id: user.id,
      subject,
      message: fullMessage,
      source: "website_ai",
      status: "open",
    });
    setBusy(false);
    if (error) {
      setFlow("done");
      console.error("AI support ticket creation failed", error);
      setMessages((current) => [...current, { from: "bot", text: "দুঃখিত, এই মুহূর্তে টিকিট জমা হয়নি। কিছুক্ষণ পর আবার চেষ্টা করুন অথবা Normal Support থেকে WhatsApp/Telegram-এ যোগাযোগ করুন।" }]);
    } else {
      setFlow("pending");
      setMessages((current) => [...current, { from: "bot", text: "ধন্যবাদ, আপনার তথ্য পেয়েছি। কিছু সময় দিয়ে সহযোগিতা করুন—আমাদের অ্যাডমিন আপনার সমস্যার সমাধানের চেষ্টা করছেন। ৫ মিনিটের মধ্যে সমাধান না হলে এই চ্যাটটি স্বয়ংক্রিয়ভাবে বন্ধ হবে; আপনার Support Request অ্যাডমিনের কাছে জমা থাকবে।" }]);
    }
  };

  return (
    <>
      <div className="fixed bottom-[8.5rem] right-4 z-50 flex flex-col items-end gap-2 sm:bottom-6">
        <button type="button" onClick={() => setOpen((value) => !value)} aria-label="Open support chat" className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl ring-4 ring-background/80 transition-transform hover:scale-105">
          {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        </button>
        {!open && <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold shadow-lg">Support Chat</span>}
      </div>

      {open && <section className="fixed inset-x-3 bottom-[10.5rem] z-50 flex max-h-[min(70vh,620px)] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl sm:inset-x-auto sm:bottom-24 sm:right-4 sm:w-[min(390px,calc(100vw-2rem))]" aria-label="Support chat">
        <header className="flex items-center justify-between gap-3 bg-primary px-4 py-3 text-primary-foreground">
          <div className="flex items-center gap-2"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15"><Bot className="h-5 w-5" /></span><div><p className="font-semibold">Support Center</p><p className="text-xs opacity-85">AI assistant & human support</p></div></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close support chat" className="rounded-full p-2 hover:bg-white/15"><X className="h-5 w-5" /></button>
        </header>

        {mode === "chooser" ? <div className="space-y-3 p-4">
          <p className="text-sm text-muted-foreground">আপনি কীভাবে সাপোর্ট নিতে চান?</p>
          <button type="button" onClick={startAI} className="flex w-full items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-left transition-colors hover:bg-primary/10">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary"><Bot className="h-6 w-6" /></span><span><span className="block font-semibold">AI Support</span><span className="block text-xs text-muted-foreground">চ্যাটে সমস্যার তথ্য দিন</span></span>
          </button>
          <div className="rounded-xl border border-border p-4"><div className="mb-3 flex items-center gap-2"><UserRound className="h-5 w-5" /><span className="font-semibold">Normal Support</span></div><div className="grid grid-cols-2 gap-2">
            {wa && <a href={wa} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-lg bg-success px-3 py-3 text-sm font-semibold text-background"><MessageCircle className="h-4 w-4" /> WhatsApp</a>}
            {tg && <a href={tg} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-3 text-sm font-semibold text-accent-foreground"><Send className="h-4 w-4" /> Telegram</a>}
            {!wa && !tg && <p className="col-span-2 text-xs text-muted-foreground">Admin Panel থেকে WhatsApp/Telegram contact সেট করতে হবে।</p>}
          </div></div>
        </div> : <>
          <div className="flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
            <div className="rounded-lg bg-muted/70 px-3 py-2 text-[11px] text-muted-foreground">আপনি AI Support Assistant-এর সঙ্গে কথা বলছেন।</div>
            {messages.map((message, index) => <div key={index} className={`flex ${message.from === "user" ? "justify-end" : "justify-start"}`}><p className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${message.from === "user" ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted text-foreground"}`}>{message.text}</p></div>)}
            {busy && <p className="text-xs text-muted-foreground">তথ্য জমা হচ্ছে…</p>}<div ref={bottomRef} />
          </div>
          {flow === "done" ? <div className="space-y-2 border-t border-border p-3">
            <div className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4" /> কথোপকথন সম্পন্ন</div>
            <button type="button" onClick={resetChat} className="w-full rounded-lg border border-border px-3 py-2 text-sm font-semibold">Back to Support options</button>
            <div className="grid grid-cols-2 gap-2">{wa && <a href={wa} target="_blank" rel="noreferrer" className="rounded-lg bg-success px-3 py-2 text-center text-sm font-semibold text-background">WhatsApp</a>}{tg && <a href={tg} target="_blank" rel="noreferrer" className="rounded-lg bg-accent px-3 py-2 text-center text-sm font-semibold text-accent-foreground">Telegram</a>}</div>
          </div> : flow === "pending" ? <div className="space-y-2 border-t border-border p-3"><p className="text-sm text-muted-foreground">আপনার Support Request জমা হয়েছে। অ্যাডমিনের উত্তর/সমাধানের জন্য অপেক্ষা করুন।</p><button type="button" onClick={() => { if (timeoutRef.current) clearTimeout(timeoutRef.current); setFlow("done"); setOpen(false); }} className="w-full rounded-lg border border-border px-3 py-2 text-sm font-semibold">চ্যাট বন্ধ করুন</button></div> : <form onSubmit={submitMessage} className="flex items-center gap-2 border-t border-border p-3">
            <input value={text} onChange={(event) => setText(event.target.value)} placeholder="আপনার মেসেজ লিখুন…" maxLength={2000} className="min-w-0 flex-1 rounded-full border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" aria-label="Your message" />
            <button type="submit" disabled={!text.trim() || busy} aria-label="Send message" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"><Send className="h-4 w-4" /></button>
          </form>}
          <button type="button" onClick={resetChat} className="border-t border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground">← Support options</button>
        </>}
      </section>}
    </>
  );
}
