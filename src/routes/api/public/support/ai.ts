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

SUPPORT REQUEST / TICKET — FOLLOW THIS CHECKLIST STRICTLY
- প্রথমে সমস্যাটি সমাধানের চেষ্টা করো। সমাধান না হলে একবারে ঠিক একটি প্রশ্ন করবে এবং একটি মাত্র তথ্য চাইবে। একই reply-তে বিকাশ নম্বর, amount, TrxID, date/time বা Order ID একসঙ্গে চাইবে না।
- পুরো conversation মনোযোগ দিয়ে পড়বে; যে তথ্য user আগেই দিয়েছে, তা আবার চাইবে না। আগের প্রশ্নের উত্তর পাওয়া গেলে সেটি আর জিজ্ঞেস করবে না। কোনো তথ্য user স্পষ্টভাবে জানে না বললে সেটি নোট করে পরের প্রয়োজনীয় প্রশ্নে যাবে।
- তথ্যের ক্রম: payment method → sender number (যদি প্রযোজ্য) → amount → TrxID → time/date বা Order ID—কিন্তু প্রতি বার শুধু পরের অনুপস্থিত একটি তথ্য চাইবে। সমস্যার ধরন অনুযায়ী অপ্রাসঙ্গিক তথ্য চাইবে না।
- PAYMENT / BKASH / NAGAD / DEPOSIT FAILED OR TRX NOT WORKING: ask for only ONE missing detail per reply, in sequence: payment method, sender number if applicable, exact amount, TrxID, date/time, Order ID if relevant, then exact error/status. Never combine these questions. Read the full conversation and never repeat a question already answered. Never ask PIN, OTP, password, or account login credentials.
- ORDER / EXPIRED / DELIVERY: collect Order ID, product/panel/service name, order status or exact error, and when it happened.
- GENERAL: collect concise problem summary, what the user tried, exact error, and relevant page/product.
- Ask for missing details one by one and explicitly confirm the values in a short summary. If the user does not have an optional field (such as Order ID), accept that and continue. Do not keep asking the same question.
- Do NOT set readyForTicket=true until the issue is still unresolved and the relevant available details above have actually been supplied by the user. For payment failures, at minimum obtain payment method, amount, TrxID (or let the user explicitly say they do not have it), and sender number if they used one. For order issues, obtain Order ID or let the user explicitly say they cannot find it.
- Once the relevant available details are collected and the issue remains unresolved, set readyForTicket=true immediately and put all customer-provided details and troubleshooting already attempted into ticketMessage. Ticket opens immediately; do not mention a 5-minute wait or say it will be created later.
- If the user says the problem is fixed, thank them and do not create a ticket. Never invent missing details.

OUTPUT CONTRACT
শুধু valid structured response দেবে: reply (string), category ("payment" | "expired" | "general"), readyForTicket (boolean), subject (string), ticketMessage (string)। JSON-এর বাইরে text দেবে না। Reply-তে এই internal keys/schema নিয়ে কথা বলবে না।`

export const Route = createFileRoute("/api/public/support/ai")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const geminiApiKey = process.env["GEMINI_API_KEY"];
        const groqApiKey = process.env["GROQ_API_KEY"];
        if (!geminiApiKey && !groqApiKey) {
          return Response.json({ error: "AI support is not configured yet. Please add GEMINI_API_KEY or GROQ_API_KEY in the Render server environment." }, { status: 503 });
        }

        try {
          const body = await request.json() as { messages?: ChatMessage[]; agentName?: string };
          if (!Array.isArray(body.messages) || body.messages.length === 0) {
            return Response.json({ error: "Please send a message to continue the support chat." }, { status: 400 });
          }

          // Long-running chats can exceed the provider's context window. Keep the latest
          // valid turns instead of rejecting the user's message as "Invalid chat messages".
          const messages = body.messages
            .filter((m): m is ChatMessage => !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim().length > 0)
            .slice(-20)
            .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
          if (!messages.length || messages[messages.length - 1]?.role !== "user") {
            return Response.json({ error: "আপনার সর্বশেষ মেসেজটি পাওয়া যায়নি। আবার লিখে Send করুন।" }, { status: 400 });
          }

          const agentName = typeof body.agentName === "string" && /^[\u0980-\u09FF]{2,20}$/.test(body.agentName) ? body.agentName : "রাকিব";
          const systemPrompt = SYSTEM_PROMPT + "\\nএই কথোপকথনে তোমার নাম: " + agentName + ".";
          let raw = "";
          let providerErrors: string[] = [];

          // Gemini is the primary provider. Groq is used as a backup if Gemini fails or reaches a limit.
          if (geminiApiKey) {
            try {
              const geminiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + encodeURIComponent(geminiApiKey), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  systemInstruction: { parts: [{ text: systemPrompt }] },
                  contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
                  generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 900,
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
                      required: ["reply", "category", "readyForTicket", "subject", "ticketMessage"],
                      propertyOrdering: ["reply", "category", "readyForTicket", "subject", "ticketMessage"]
                    }
                  }
                })
              });
              if (geminiResponse.ok) {
                const geminiData = await geminiResponse.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
                const candidateText = geminiData.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
                // Only accept a response that matches the support JSON contract. Invalid or blocked
                // Gemini output must trigger the backup provider instead of breaking the whole chat.
                try {
                  const candidate = JSON.parse(candidateText) as { reply?: unknown; category?: unknown; readyForTicket?: unknown; subject?: unknown; ticketMessage?: unknown };
                  if (
                    typeof candidate.reply === "string" &&
                    typeof candidate.readyForTicket === "boolean" &&
                    typeof candidate.subject === "string" &&
                    typeof candidate.ticketMessage === "string"
                  ) {
                    raw = candidateText;
                  } else {
                    providerErrors.push("Gemini returned an invalid support response");
                  }
                } catch {
                  providerErrors.push(candidateText ? "Gemini returned malformed JSON" : "Gemini returned an empty response");
                }
              } else {
                const detail = await geminiResponse.text();
                console.error("Gemini support API error", geminiResponse.status, detail.slice(0, 300));
                providerErrors.push("Gemini HTTP " + geminiResponse.status);
              }
            } catch (error) {
              console.error("Gemini support API request failed", error);
              providerErrors.push("Gemini request failed");
            }
          }

          if (!raw && groqApiKey) {
            try {
              const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqApiKey}` },
                body: JSON.stringify({
                  model: "openai/gpt-oss-20b",
                  reasoning_format: "hidden",
                  reasoning_effort: "low",
                  messages: [{ role: "system", content: systemPrompt }, ...messages],
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
              if (groqResponse.ok) {
                const groqData = await groqResponse.json() as { choices?: Array<{ message?: { content?: string | null } }> };
                const candidateText = groqData.choices?.[0]?.message?.content ?? "";
                try {
                  const candidate = JSON.parse(candidateText) as { reply?: unknown; readyForTicket?: unknown; subject?: unknown; ticketMessage?: unknown };
                  if (
                    typeof candidate.reply === "string" &&
                    typeof candidate.readyForTicket === "boolean" &&
                    typeof candidate.subject === "string" &&
                    typeof candidate.ticketMessage === "string"
                  ) {
                    raw = candidateText;
                  } else {
                    providerErrors.push("Groq returned an invalid support response");
                  }
                } catch {
                  providerErrors.push(candidateText ? "Groq returned malformed JSON" : "Groq returned an empty response");
                }
              } else {
                const detail = await groqResponse.text();
                console.error("Groq backup support API error", groqResponse.status, detail.slice(0, 300));
                providerErrors.push("Groq HTTP " + groqResponse.status);
              }
            } catch (error) {
              console.error("Groq backup support API request failed", error);
              providerErrors.push("Groq request failed");
            }
          }

          if (!raw) {
            return Response.json({
              error: "AI support is temporarily unavailable. Please try again shortly or use Normal Support."
            }, { status: 503 });
          }

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