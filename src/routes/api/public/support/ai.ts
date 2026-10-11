import { createFileRoute } from "@tanstack/react-router";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `তুমি Panel Bazar BD ওয়েবসাইটের বাংলা/Banglish customer support assistant। তোমার নাম request-এ দেওয়া agentName। বন্ধুসুলভ, স্বাভাবিক কথোপকথন করবে; "hi" বললে শুধু greeting দিয়ে জিজ্ঞেস করবে কীভাবে সাহায্য করতে পারো। সব প্রশ্ন একসাথে করবে না; ব্যবহারকারীর উত্তর বুঝে পরের প্রয়োজনীয় প্রশ্ন করবে।

কাজের নিয়ম:
- ব্যবহারকারী কী সমস্যা বলছে তা আগে বুঝবে। পেমেন্ট হয়েছে কিন্তু ব্যালেন্স আসেনি/পেমেন্ট পাওয়া যায়নি: টাকা পাঠানো নম্বর এবং Transaction ID (TrxID) সংগ্রহ করো। সম্ভব হলে amount/payment method-ও জিজ্ঞেস করো।
- প্যানেল expired/মেয়াদ শেষ/অর্ডার সমস্যা: Panel name এবং Order ID সংগ্রহ করো।
- অন্য সমস্যা: কী করতে গিয়ে কী সমস্যা, সংশ্লিষ্ট panel/service name, Order ID থাকলে সেটি, error message থাকলে সেটি জিজ্ঞেস করো।
- ব্যবহারকারী প্রয়োজনীয় তথ্য না দিলে আরও প্রশ্ন করবে। শুধু "hi", "ok", "কি", "হুম" ইত্যাদিতে কখনো টিকিট ready বলবে না।
- প্রয়োজনীয় তথ্য পেলে বলবে: তথ্য পেয়েছ এবং support team-কে পাঠানোর জন্য প্রস্তুত করছ। তুমি নিজে সমাধান, refund বা balance credit হয়েছে বলে দাবি করবে না।
- টিকিট প্রস্তুত বলে শুধু তখনই চিহ্নিত করবে যখন সমস্যার বিবরণ এবং ঐ সমস্যার প্রয়োজনীয় তথ্য কথোপকথনে সত্যিই আছে।
- তথ্য সংগ্রহ শেষ হলে reply-তে জানাবে যে support request তৈরি হবে এবং অ্যাডমিন দেখবেন।
- সর্বদা শুধু বৈধ JSON object ফেরত দেবে, এই keys-সহ: reply (string), category ("payment" | "expired" | "general"), readyForTicket (boolean), subject (string), ticketMessage (string)। JSON-এর বাইরে কোনো লেখা দেবে না।`;

export const Route = createFileRoute("/api/public/support/ai")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["GROQ_API_KEY"];
        if (!apiKey) {
          return Response.json({ error: "AI support is not configured yet. Please set GROQ_API_KEY in the Render server environment." }, { status: 503 });
        }

        try {
          const body = await request.json() as { messages?: ChatMessage[]; agentName?: string };
          if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 30) {
            return Response.json({ error: "Invalid chat messages." }, { status: 400 });
          }

          const messages = body.messages
            .filter((m): m is ChatMessage => !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
            .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
          if (!messages.length || messages[messages.length - 1]?.role !== "user") {
            return Response.json({ error: "A user message is required." }, { status: 400 });
          }

          const agentName = typeof body.agentName === "string" && /^[\u0980-\u09FF]{2,20}$/.test(body.agentName) ? body.agentName : "রাকিব";
          const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: "llama-3.1-8b-instant",
              messages: [
                { role: "system", content: SYSTEM_PROMPT + "\\nএই কথোপকথনে তোমার নাম: " + agentName + "." },
                ...messages
              ],
              response_format: { type: "json_object" },
              temperature: 0.3,
              max_tokens: 700
            })
          });

          if (!response.ok) {
            const detail = await response.text();
            console.error("Groq support API error", response.status, detail.slice(0, 300));
            if (response.status === 401 || response.status === 403) {
              return Response.json({ error: "AI support API key is invalid or not authorized. Please check GROQ_API_KEY in Render." }, { status: 503 });
            }
            if (response.status === 429) {
              return Response.json({ error: "AI support has reached its current usage limit. Please try again later or use Normal Support." }, { status: 503 });
            }
            return Response.json({ error: "AI support is temporarily busy. Please try again or use Normal Support." }, { status: 502 });
          }

          const data = await response.json() as {
            choices?: Array<{ message?: { content?: string | null } }>;
          };
          const raw = data.choices?.[0]?.message?.content ?? "";
          const parsed = JSON.parse(raw) as { reply: string; category: string; readyForTicket: boolean; subject: string; ticketMessage: string };
          if (typeof parsed.reply !== "string" || typeof parsed.readyForTicket !== "boolean") {
            return Response.json({ error: "Invalid AI response." }, { status: 502 });
          }
          return Response.json({
            reply: parsed.reply.slice(0, 1500),
            category: ["payment", "expired", "general"].includes(parsed.category) ? parsed.category : "general",
            readyForTicket: parsed.readyForTicket,
            subject: (parsed.subject || "Website AI Support").slice(0, 160),
            ticketMessage: (parsed.ticketMessage || "").slice(0, 5000)
          });
        } catch (error) {
          console.error("Support AI route failed", error);
          return Response.json({ error: "Could not process your message. Please try again." }, { status: 500 });
        }
      }
    }
  }
});
