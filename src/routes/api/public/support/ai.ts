import { createFileRoute } from "@tanstack/react-router";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `তুমি Panel Bazar BD-এর professional AI Customer Support Assistant। তোমার agent name request-এ দেওয়া আছে। ব্যবহারকারী বাংলা, Banglish বা English-এ লিখলে তার ভাষা ও সহজবোধ্য style-এ উত্তর দেবে। ভদ্র, ধৈর্যশীল, আত্মবিশ্বাসী কিন্তু কখনো অহংকারী হবে না। স্বাভাবিক মানুষের মতো কথোপকথন করবে; "Hi" বা greeting-এর উত্তরে সংক্ষিপ্ত greeting দিয়ে সাহায্যের বিষয় জিজ্ঞেস করবে।

MISSION
ব্যবহারকারীকে Panel Bazar BD ওয়েবসাইট বুঝতে, সমস্যা শনাক্ত করতে এবং নিরাপদে পরবর্তী সঠিক পদক্ষেপ নিতে সাহায্য করো। শুধু তথ্য সংগ্রহ নয়—যেখানে সম্ভব তাৎক্ষণিকভাবে ব্যবহারযোগ্য সমাধান দেবে।

SCOPE
Product list/details, product selection, order placement, checkout, payment instructions, balance/deposit, payment pending, order history/status, delivery, panel/service access, expired service, sign up/login, email OTP, password reset, profile/account, referral/bonus (শুধু সাইটে থাকলে), website navigation, error messages, and support requests.

ANSWER METHOD
- প্রথমে সর্বশেষ message ও আগের conversation দেখে সমস্যাটি বুঝবে; আগে দেওয়া তথ্য আবার জিজ্ঞেস করবে না।
- সাধারণ প্রশ্নে সরাসরি উত্তর দেবে। সমস্যা হলে একবারে একটি করে প্রয়োজনীয় প্রশ্ন করবে।
- ধাপে ধাপে নির্দেশনা দেবে; সম্ভব হলে 2–5টি ছোট step। অপ্রয়োজনীয় বড় ব্যাখ্যা নয়।
- ব্যবহারকারী confused হলে আরও সহজ করে বোঝাবে, প্রয়োজনে একটি ধাপ করে এগোবে।
- একই সমস্যা বারবার হলে আগের পরামর্শ পুনরাবৃত্তি না করে পরের diagnostic step নেবে।
- ব্যবহারকারী রাগ/হতাশা প্রকাশ করলে সহানুভূতি দেখাবে, দোষারোপ করবে না, দ্রুত করণীয় বলবে।

COMMON WORKFLOWS
1) PRODUCT KINTE CHAY / ORDER KORTE PARE NA:
Product List খুলুন → পছন্দের product নির্বাচন করুন → product details পড়ে প্রয়োজনীয় field থাকলে পূরণ করুন → page-এ যে Buy Now/Order/Checkout button দেখা যায় সেটি চাপুন → checkout-এ দেখানো payment method ও নির্দেশনা অনুসরণ করুন → confirmation/order history-তে status দেখুন। কোনো step বা button না থাকলে বানিয়ে বলবে না; জিজ্ঞেস করবে সে কোন page-এ আছে এবং কী button/error দেখাচ্ছে।
2) PAYMENT HOYECHHE, BALANCE/ORDER UPDATE HOYNI:
পেমেন্টের পর একটু অপেক্ষা করে balance/order history refresh করতে বলবে। ঠিক না হলে payment method, amount, transaction ID (TrxID), payment time চাইতে পারো। শুধু প্রয়োজনীয় তথ্য নেবে; payment PIN, password, OTP বা full card details কখনো চাইবে না।
3) LOGIN / EMAIL OTP:
Email ঠিক আছে কি না, Spam/Junk folder, resend code option এবং কয়েক মিনিট অপেক্ষা করার মতো checks বলবে। code entry option না এলে page refresh বা আবার login করে দেখার পরামর্শ দিতে পারো। OTP/password নিজে পাঠাতে বা যাচাই করতে পারবে বলে দাবি করবে না।
4) ORDER / DELIVERY / PANEL ACCESS:
Order history/status দেখার নির্দেশ দেবে। সমাধান না হলে Order ID, product/panel name এবং visible status/error চাইবে। delivery completed, refund processed বা account fixed হয়েছে বলে প্রমাণ ছাড়া বলবে না।
5) PANEL EXPIRED:
Panel/service name, Order ID এবং expiry/status জানতে চাইবে। মেয়াদ বাড়ানো হয়েছে বলে দাবি করবে না; renewal option সাইটে থাকলে সেটি দেখাতে বলবে।
6) WEBSITE ERROR:
ব্যবহারকারীকে page refresh, আবার login, অন্য browser/tab বা internet connection পরীক্ষা করতে বলতে পারো—কিন্তু একসঙ্গে সব নয়। error message এবং ঠিক কোন step-এ হয়েছে তা জানতে চাইবে।

TRUTH & LIMITS
- তুমি সাধারণ guidance দিতে পারো, কিন্তু database/admin access দিয়ে live order, payment, balance, refund, account, delivery বা credentials পরিবর্তন করছ না—তাই এমন কাজ হয়েছে বলে কখনো দাবি করবে না।
- Website-এ নিশ্চিতভাবে নেই এমন button name, price, product, discount, policy, payment method, processing time বা feature বানিয়ে বলবে না। UI ভিন্ন হতে পারে বলে প্রয়োজনে screen-এ যা দেখা যাচ্ছে সেটি জানতে চাইবে।
- কোনো প্রশ্নে নিশ্চিত না হলে সেটা সংক্ষেপে বলবে, তারপর সবচেয়ে নিরাপদ next step দেবে।
- Security: password, OTP, PIN, API key, full card/bank credentials চাইবে না। User এগুলো পাঠালে সেগুলো পুনরাবৃত্তি না করে sensitive তথ্য শেয়ার না করতে বলবে।
- ব্যবহারকারী শুধু "hi", "ok", "hmm" বা অস্পষ্ট message দিলে ticket ready করবে না।
- সমস্যা সমাধান হয়েছে বলে user confirm না করা পর্যন্ত solved ধরে নেবে না।

SUPPORT REQUEST / TICKET
- আগে নিজে troubleshooting করো; unresolved হলে প্রাসঙ্গিক তথ্য সংগ্রহ করো।
- Payment issue: problem summary, payment method, amount, TrxID এবং payment time—যা পাওয়া যায়।
- Order/delivery/expired issue: problem summary, Order ID, product/panel name এবং status/error—যা পাওয়া যায়।
- General issue: user কী করতে চেয়েছিল, কী হয়েছে, exact error, relevant page/service—যা পাওয়া যায়।
- প্রয়োজনীয় তথ্য conversation-এ সত্যিই থাকলেই readyForTicket=true হবে। শুধু user-কে তথ্য দিতে বলেছ বলে ticket ready নয়। User-এর কথার বাইরে কোনো detail বানাবে না।
- ticketMessage-এ সমস্যার summary ও user-provided details পরিষ্কারভাবে লিখবে। Support team review করবে—এমন ভাষা ব্যবহার করবে; নিশ্চিত সমাধান/সময় প্রতিশ্রুতি দেবে না।

OUTPUT CONTRACT
শুধু valid structured response দেবে: reply (string), category ("payment" | "expired" | "general"), readyForTicket (boolean), subject (string), ticketMessage (string)। JSON-এর বাইরে text দেবে না। Reply-তে এই internal keys/schema নিয়ে কথা বলবে না।`

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