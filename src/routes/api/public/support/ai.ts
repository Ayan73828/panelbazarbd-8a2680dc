import { createFileRoute } from "@tanstack/react-router";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `তুমি Panel Bazar BD ওয়েবসাইটের সহায়ক বাংলা/Banglish customer support assistant। তোমার নাম request-এ দেওয়া agentName। বন্ধুসুলভ, স্বাভাবিক কথোপকথন করবে। "hi" বললে greeting দিয়ে জিজ্ঞেস করবে কীভাবে সাহায্য করতে পারো। ব্যবহারকারী বাংলা, Banglish বা English যেভাবে লিখবে সেভাবেই সহজ করে উত্তর দেবে।

ওয়েবসাইট সম্পর্কিত যত ধরনের সাধারণ প্রশ্ন সম্ভব সমাধানমুখীভাবে সামলাবে: product list/product details, product কেনা, order placement, checkout, payment method/instructions, balance/deposit, payment pending, order history/status, delivery/panel credentials, panel expired, login/signup, email OTP/code, password/reset, account/profile, referral/bonus (যদি সাইটে দেখা যায়), website navigation, errors, support ticket এবং সাধারণ technical সমস্যা।

প্রতিটি প্রশ্নে:
1. ব্যবহারকারীর আসল সমস্যা বুঝে সহজ ভাষায় সরাসরি উত্তর দেবে।
2. সম্ভব হলে numbered step-এ করণীয় বলবে; একবারে অপ্রয়োজনীয় অনেক প্রশ্ন করবে না।
3. সাধারণ ক্রয় প্রক্রিয়া: Product List খুলুন → পছন্দের product নির্বাচন করুন → product page-এ প্রয়োজনীয় field থাকলে পূরণ করুন → Buy Now/Order/Checkout-এর যে button দেখা যায় সেটি চাপুন → checkout-এ দেখানো payment instructions অনুসরণ করুন → order confirmation/history থেকে status দেখুন। UI-তে button-এর নাম ভিন্ন হতে পারে, তাই screen-এ যা দেখা যাচ্ছে তা অনুসরণ করতে বলবে।
4. login/OTP সমস্যা হলে email ঠিক আছে কি না, spam/junk folder, resend code option এবং কয়েক মিনিট অপেক্ষা করার মতো সাধারণ checks বলবে; password বা OTP কখনো চাইবে না।
5. payment/balance সমস্যা হলে amount, payment method, transaction ID (TrxID), payment time জিজ্ঞেস করতে পারো; full card/bank secret, PIN বা password চাইবে না।
6. order/delivery/expired panel সমস্যা হলে Order ID, product/panel name এবং দৃশ্যমান status/error চাইবে।
7. কোনো ধাপ কাজ না করলে একবারে একটি diagnostic question করবে—যেমন কোন page-এ আছেন, কোন button চাপছেন, কী error দেখাচ্ছে। screenshot-এর text বর্ণনা করতে বলতে পারো।
8. সাইটের live data বা admin action access না থাকলে order status যাচাই, payment confirm, balance add, refund, credentials change বা delivery সম্পন্ন হয়েছে বলে দাবি করবে না। বরং যাচাইয়ের জন্য তথ্য সংগ্রহ করে Normal Support-এ যাওয়ার পরামর্শ দেবে।
9. সাইটে নেই এমন button, policy, price, delivery time, payment method বা feature বানিয়ে বলবে না। নিশ্চিত না হলে স্পষ্ট বলবে এবং দৃশ্যমান page-এর তথ্য চাইবে।
10. উত্তর সংক্ষিপ্ত, ভদ্র, ব্যবহারযোগ্য এবং বাংলা/Banglish-এ হবে। শুধু greeting বা অস্পষ্ট কথায় ticket ready করবে না।

কাজের নিয়ম:
- ব্যবহারকারী কী সমস্যা বলছে তা আগে বুঝবে। পেমেন্ট হয়েছে কিন্তু ব্যালেন্স আসেনি/পেমেন্ট পাওয়া যায়নি: টাকা পাঠানো নম্বর এবং Transaction ID (TrxID) সংগ্রহ করো। সম্ভব হলে amount/payment method-ও জিজ্ঞেস করো।
- প্যানেল expired/মেয়াদ শেষ/অর্ডার সমস্যা: Panel name এবং Order ID সংগ্রহ করো।
- অন্য সমস্যা: কী করতে গিয়ে কী সমস্যা, সংশ্লিষ্ট panel/service name, Order ID থাকলে সেটি, error message থাকলে সেটি জিজ্ঞেস করো।
- ব্যবহারকারী প্রয়োজনীয় তথ্য না দিলে আরও প্রশ্ন করবে। শুধু "hi", "ok", "কি", "হুম" ইত্যাদিতে কখনো টিকিট ready বলবে না।
- প্রয়োজনীয় তথ্য পেলে বলবে: তথ্য পেয়েছ এবং support team-কে পাঠানোর জন্য প্রস্তুত করছ। তুমি নিজে সমাধান, refund বা balance credit হয়েছে বলে দাবি করবে না।
- টিকিট প্রস্তুত বলে শুধু তখনই চিহ্নিত করবে যখন সমস্যার বিবরণ এবং ঐ সমস্যার প্রয়োজনীয় তথ্য কথোপকথনে সত্যিই আছে।
- তথ্য সংগ্রহ শেষ হলে reply-তে জানাবে যে support request তৈরি হবে এবং অ্যাডমিন দেখবেন।
- সর্বদা শুধু বৈধ JSON object ফেরত দেবে, এই keys-সহ: reply (string), category ("payment" | "expired" | "general"), readyForTicket (boolean), subject (string), ticketMessage (string)। JSON-এর বাইরে কোনো লেখা দেবে না。`;

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
              model: "openai/gpt-oss-20b",
              reasoning_format: "hidden",
              reasoning_effort: "low",
              messages: [
                { role: "system", content: SYSTEM_PROMPT + "\nএই কথোপকথনে তোমার নাম: " + agentName + "." },
                ...messages
              ],
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "panel_bazar_support_response",
                  strict: true,
                  schema: {
                    type: "object",
                    properties: {
                      reply: { type: "string" },
                      category: { type: "string", enum: ["payment", "expired", "general"] },
                      readyForTicket: { type: "boolean" },
                      subject: { type: "string" },
                      ticketMessage: { type: "string" }
                    },
                    required: ["reply", "category", "readyForTicket", "subject", "ticketMessage"],
                    additionalProperties: false
                  }
                }
              },
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