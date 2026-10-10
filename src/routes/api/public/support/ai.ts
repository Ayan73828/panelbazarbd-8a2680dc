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
- তথ্য সংগ্রহ শেষ হলে reply-তে জানাবে যে support request তৈরি হবে এবং অ্যাডমিন দেখবেন। `;

export const Route = createFileRoute("/api/public/support/ai")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["GEMINI_API_KEY"];
        if (!apiKey) {
          return Response.json({ error: "AI support is not configured yet. Please set GEMINI_API_KEY in the server environment." }, { status: 503 });
        }

        try {
          const body = await request.json() as { messages?: ChatMessage[]; agentName?: string };
          if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 30) {
            return Response.json({ error: "Invalid chat messages." }, { status: 400 });
          }

          const messages = body.messages
            .filter((m): m is ChatMessage => !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
            .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content.slice(0, 2000) }] }));
          if (!messages.length || messages[messages.length - 1]?.role !== "user") {
            return Response.json({ error: "A user message is required." }, { status: 400 });
          }

          const agentName = typeof body.agentName === "string" && /^[\u0980-\u09FF]{2,20}$/.test(body.agentName) ? body.agentName : "রাকিব";
          // Prefer Flash-Lite for broad availability, then fall back to Flash if the first model is busy.
          const modelCandidates = ["gemini-3.5-flash-lite", "gemini-3.8-flash"];
          let data: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> } | null = null;
          for (const model of modelCandidates) {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: SYSTEM_PROMPT + "\\nএই কথোপকথনে তোমার নাম: " + agentName + "." }] },
                contents: messages,
                generationConfig: {
                  responseMimeType: "application/json",
                  responseSchema: {
                    type: "OBJECT",
                    properties: {
                      reply: { type: "STRING" },
                      category: { type: "STRING", enum: ["payment", "expired", "general"] },
                      readyForTicket: { type: "BOOLEAN" },
                      subject: { type: "STRING" },
                      ticketMessage: { type: "STRING" }
                    },
                    required: ["reply", "category", "readyForTicket", "subject", "ticketMessage"]
                  }
                }
              })
            });

            if (response.ok) {
              data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
              break;
            }

            const detail = await response.text();
            console.error("Gemini support API error", model, response.status, detail.slice(0, 300));
            // Try the next model when the current model is unavailable, rate-limited, or overloaded.
            if (![400, 404, 429, 500, 502, 503, 504].includes(response.status)) break;
          }

          if (!data) {
            return Response.json({ error: "AI support is temporarily busy. Please wait a few seconds and try again, or use Normal Support." }, { status: 502 });
          }

          const raw = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
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
