// Server-only Telegram bot logic. Uses the same database as the website.
import { notifyOwner } from "@/lib/uddoktapay.server";

export const SITE_URL = process.env["SITE_URL"] || "https://panelbazarbd.shop";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function tg(method: string, body: Record<string, unknown>) {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN missing");
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({}))) as any;
  if (!j.ok) console.error("telegram", method, j);
  return j;
}
export const tgApi = tg;

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const tk = (n: number) => `৳${Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const dualMoney = (n: number) => `${Number(n ?? 0).toFixed(2)} (${tk(Number(n ?? 0) * 100)})`;

const MENU = {
  inline_keyboard: [
    [{ text: "🛍️ Shop Now", callback_data: "menu:products" }],
    [{ text: "🧾 My Order", callback_data: "menu:orders" }, { text: "👑 Profile", callback_data: "menu:profile" }],
    [{ text: "💳 Add Balance", callback_data: "menu:fund" }, { text: "🤝 Referral", callback_data: "menu:referral" }],
    [{ text: "💬 Support", callback_data: "menu:support" }],
  ],
};
const RESTART_KEYBOARD = {
  keyboard: [[{ text: "Restart 🔁" }]],
  resize_keyboard: true,
  is_persistent: true,
  input_field_placeholder: "Restart the bot",
};
const SHARE_NUMBER = {
  keyboard: [[{ text: "📱 SHARE MY NUMBER", request_contact: true }]],
  resize_keyboard: true,
};
const GUEST_AUTH = {
  inline_keyboard: [[{ text: "🔐 LOGIN", callback_data: "guest:login" }, { text: "🆕 CREATE ACCOUNT", callback_data: "guest:register" }]],
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function setState(chatId: number, state: string, data: Record<string, unknown> = {}) {
  const db = await admin();
  const current = await getState(chatId);
  await db.from("telegram_sessions").upsert({
    chat_id: chatId,
    state,
    data: { ...(current.data ?? {}), ...data },
    updated_at: new Date().toISOString(),
  });
}
async function rememberMessage(chatId: number, messageId: number) {
  const db = await admin();
  const current = await getState(chatId);
  const ids = Array.isArray(current.data?.recent_bot_message_ids) ? current.data.recent_bot_message_ids : [];
  await db.from("telegram_sessions").upsert({
    chat_id: chatId,
    state: current.state ?? "",
    data: { ...(current.data ?? {}), recent_bot_message_ids: [...ids, messageId].slice(-80) },
    updated_at: new Date().toISOString(),
  });
}
async function getState(chatId: number) {
  const db = await admin();
  const { data } = await db.from("telegram_sessions").select("*").eq("chat_id", chatId).maybeSingle();
  return (data ?? { state: "", data: {} }) as { state: string; data: any };
}
async function linkedUser(tgUserId: number) {
  const db = await admin();
  const { data } = await db.from("telegram_links").select("user_id").eq("telegram_user_id", tgUserId).maybeSingle();
  if (!data) return null;
  const { data: p } = await db.from("profiles").select("*").eq("id", data.user_id).maybeSingle();
  return p as any;
}
const screen = async (chat_id: number, message_id: number | undefined, text: string, reply_markup?: unknown) => {
  if (typeof message_id === "number") {
    const result = await tg("editMessageText", { chat_id, message_id, text, parse_mode: "HTML", disable_web_page_preview: true, ...(reply_markup ? { reply_markup } : {}) });
    if (result?.ok || String(result?.description ?? "").includes("message is not modified")) return result;
  }
  return send(chat_id, text, reply_markup);
};

const send = async (chat_id: number, text: string, reply_markup?: unknown) => {
  if (!String(text ?? "").trim()) {
    console.error("Telegram send skipped: empty text", { chat_id });
    return { ok: false, description: "Empty message text" };
  }
  const result = await tg("sendMessage", { chat_id, text, parse_mode: "HTML", disable_web_page_preview: true, ...(reply_markup ? { reply_markup } : {}) });
  const id = result?.result?.message_id;
  if (typeof id === "number") await rememberMessage(chat_id, id).catch((e) => console.error("telegram message tracking", e));
  return result;
};

async function welcome(chatId: number, user: any, messageId?: number) {
  if (user) {
    const welcomeText = `🏪 ━━ <b>Panel Bazar BD</b> ━━ 🏪\n\n👋 Welcome back, <b>${esc(user.name || user.username || "Customer")}</b>\n\n⭐ ━ <b>REGULAR HIGHLIGHTS</b> ━ ⭐\n\n│ 🔑 Wholesale Game Keys &amp; VIP Stocks\n│ ⚡ Priority Auto-Delivery 24/7\n│ 🎁 Tiered Referral\n│ 📞 Dedicated VIP Partner Support\n\n━━━━━━━━━━━━━━━━━━━━━\n\n🚀 <b>Tap Shop Now to Start!</b>`;
    if (typeof messageId === "number") await screen(chatId, messageId, welcomeText, MENU);
    else await send(chatId, welcomeText, MENU);
    if (typeof messageId !== "number") await send(chatId, " ", RESTART_KEYBOARD);
  } else {
    const st = await getState(chatId);
    if (st.data?.phone_shared) {
      await send(chatId, "👋 <b>PANEL BAZAR BD</b> এ স্বাগতম!\n\nএখন LOGIN করুন অথবা CREATE ACCOUNT করুন।", GUEST_AUTH);
    } else {
      await send(chatId, "👋 <b>PANEL BAZAR BD</b> এ স্বাগতম!\n\nশুরু করতে নিচের SHARE MY NUMBER বাটনে চাপ দিন।", SHARE_NUMBER);
    }
  }
}

export async function handleUpdate(u: any) {
  if (u.callback_query) return handleCallback(u.callback_query);
  const m = u.message;
  if (!m?.chat?.id || !m.from?.id) return;
  const chatId = m.chat.id as number;
  const text: string = (m.text ?? "").trim();
  const user = await linkedUser(m.from.id);
  const st = await getState(chatId);

  if (text === "Restart 🔁") {
    const oldIds = Array.isArray(st.data?.recent_bot_message_ids) ? st.data.recent_bot_message_ids : [];
    for (const message_id of oldIds) await tg("deleteMessage", { chat_id: chatId, message_id }).catch(() => undefined);
    await setState(chatId, st.data?.phone_shared ? (user ? "" : "guest_auth") : (user ? "" : "guest_share_number"), { recent_bot_message_ids: [] });
    if (user) return welcome(chatId, user);
    if (st.data?.phone_shared) return send(chatId, "✅ নম্বর আগে থেকেই শেয়ার করা আছে। এখন LOGIN করুন অথবা CREATE ACCOUNT করুন।", GUEST_AUTH);
    return send(chatId, "👋 <b>PANEL BAZAR BD</b> এ স্বাগতম!\n\nশুরু করতে নিচের SHARE MY NUMBER বাটনে চাপ দিন।", SHARE_NUMBER);
  }
  if (text.startsWith("/start")) {
    const oldIds = Array.isArray(st.data?.recent_bot_message_ids) ? st.data.recent_bot_message_ids : [];
    for (const message_id of oldIds) await tg("deleteMessage", { chat_id: chatId, message_id }).catch(() => undefined);
    const payload = text.split(/\s+/)[1] ?? "";
    const referrerId = payload.startsWith("ref_") ? payload.slice(4) : st.data?.pending_referrer_id;
    const nextData = { recent_bot_message_ids: [], pending_referrer_id: referrerId || null };
    await setState(chatId, st.data?.phone_shared ? (user ? "" : "guest_auth") : (user ? "" : "guest_share_number"), nextData);
    if (user) return welcome(chatId, user);
    if (st.data?.phone_shared) return send(chatId, "✅ নম্বর আগে থেকেই শেয়ার করা আছে। এখন LOGIN করুন অথবা CREATE ACCOUNT করুন।", GUEST_AUTH);
    return send(chatId, "👋 <b>PANEL BAZAR BD</b> এ স্বাগতম!\n\nশুরু করতে নিচের SHARE MY NUMBER বাটনে চাপ দিন।", SHARE_NUMBER);
  }
  if (st.state === "admin_support_reply" && text) {
    if (String(chatId) !== String(process.env["TELEGRAM_OWNER_CHAT_ID"] ?? "")) return;
    if (text === "/cancel") { await setState(chatId, ""); return send(chatId, "Reply বাতিল করা হয়েছে।"); }
    const ticketId = String(st.data?.support_ticket_id ?? "");
    const db = await admin();
    const { data: ticket } = await db.from("support_tickets").select("id,user_id,subject,telegram_chat_id,status").eq("id", ticketId).eq("status", "open").maybeSingle();
    if (!ticket) { await setState(chatId, ""); return send(chatId, "টিকিটটি পাওয়া যায়নি বা আগেই বন্ধ হয়েছে।"); }
    const { data: admins } = await db.from("user_roles").select("user_id").eq("role", "admin").limit(1);
    const adminId = admins?.[0]?.user_id;
    if (!adminId) return send(chatId, "Admin profile পাওয়া যায়নি; reply সংরক্ষণ হয়নি।");
    const { error: replyError } = await db.from("support_replies").insert({ ticket_id: ticket.id, user_id: adminId, message: text.slice(0, 2000) });
    if (replyError) { console.error("Telegram support reply failed", replyError); return send(chatId, "Reply save হয়নি। আবার চেষ্টা করুন।"); }
    await db.from("support_tickets").update({ status: "resolved", updated_at: new Date().toISOString() }).eq("id", ticket.id);
    const { data: link } = await db.from("telegram_links").select("telegram_chat_id").eq("user_id", ticket.user_id).maybeSingle();
    const customerChat = ticket.telegram_chat_id ?? link?.telegram_chat_id;
    if (customerChat) await send(Number(customerChat), `📩 <b>Support থেকে উত্তর এসেছে</b>\nটিকিট: <code>${esc(ticket.id)}</code>\n\n${esc(text.slice(0, 2000))}\n\nআপনার টিকিটটি সমাধান হিসেবে বন্ধ করা হয়েছে।`);
    await setState(chatId, "");
    return send(chatId, "✅ Reply পাঠানো হয়েছে এবং টিকিট resolved করা হয়েছে।");
  }
  if (st.state === "support_ticket_details" && (text || m.photo?.length)) {
    if (text === "/cancel") {
      await setState(chatId, "");
      return showSupport(chatId);
    }
    const details = String(m.caption ?? text ?? "").trim();
    if (details.length < 5) return send(chatId, "সমস্যার বিস্তারিত একটু লিখুন; চাইলে একই মেসেজে screenshot/photo দিন।");
    const photo = Array.isArray(m.photo) && m.photo.length ? m.photo[m.photo.length - 1].file_id : null;
    const ticketDb = await admin();
    const ticketState = await getState(chatId);
    const ownerId = String(ticketState.data?.support_user_id ?? user?.id ?? "");
    if (!ownerId) return send(chatId, "Account link পাওয়া যায়নি। আগে website account দিয়ে Telegram-এ LOGIN করুন।");
    const { data: existing } = await ticketDb.from("support_tickets").select("id").eq("user_id", ownerId).eq("status", "open").limit(1).maybeSingle();
    if (existing) {
      await setState(chatId, "");
      return send(chatId, `আপনার একটি Support Ticket এখনও খোলা আছে। Admin উত্তর দিলে নতুন টিকিট করতে পারবেন।\nTicket ID: <code>${esc(existing.id)}</code>`);
    }
    const { data: ticket, error: ticketError } = await ticketDb.from("support_tickets").insert({
      user_id: ownerId, subject: "Telegram Support Ticket", message: details, source: "telegram", telegram_user_id: m.from.id, telegram_chat_id: chatId, photo_file_id: photo,
    }).select("id").single();
    if (ticketError) {
      console.error("Support ticket save failed", ticketError);
      return send(chatId, "Ticket save করা যায়নি। আবার চেষ্টা করুন বা Telegram Admin-কে message দিন।");
    }
    await setState(chatId, "");
    const ticketNotice = "🎫 <b>New Support Ticket</b>\\nTicket: <code>" + esc(ticket.id) + "</code>\\nSource: Telegram Bot\\nUser: <code>" + esc(ownerId) + "</code>\\nTelegram ID: <code>" + m.from.id + "</code>\\nDetails: " + esc(details);
    const ownerChatId = process.env["TELEGRAM_OWNER_CHAT_ID"];
    const keyboard = { inline_keyboard: [[{ text: "↩️ Reply", callback_data: "supportreply:" + ticket.id }, { text: "✅ Close", callback_data: "supportclose:" + ticket.id }]] };
    if (photo && ownerChatId) await tg("sendPhoto", { chat_id: ownerChatId, photo, caption: ticketNotice, parse_mode: "HTML", reply_markup: keyboard });
    else if (ownerChatId) await tg("sendMessage", { chat_id: ownerChatId, text: ticketNotice, parse_mode: "HTML", reply_markup: keyboard });
    else await notifyOwner(ticketNotice + (photo ? "\\nPhoto file ID: " + esc(photo) : ""));
    return send(chatId, "✅ আপনার Support Ticket জমা হয়েছে।\nTicket ID: <code>" + esc(ticket.id) + "</code>\nAdmin-কে জানানো হয়েছে।", { inline_keyboard: [[{ text: "⬅️ Main Menu", callback_data: "menu:home" }]] });
  }
  if (m.contact) {
    if (st.data?.phone_shared) return send(chatId, "✅ নম্বর আগে থেকেই শেয়ার করা আছে। এখন LOGIN করুন অথবা CREATE ACCOUNT করুন।", GUEST_AUTH);
    if (!m.contact.user_id || m.contact.user_id !== m.from.id) return send(chatId, "⚠️ নিজের নম্বর SHARE MY NUMBER বাটন দিয়ে শেয়ার করুন।", SHARE_NUMBER);
    await setState(chatId, "guest_auth", { phone_shared: true, phone: String(m.contact.phone_number ?? "").slice(0, 30) });
    await tg("sendMessage", { chat_id: chatId, text: " ", reply_markup: { remove_keyboard: true } });
    return send(chatId, "✅ নম্বর পেয়েছি। এখন LOGIN করুন অথবা CREATE ACCOUNT করুন।", GUEST_AUTH);
  }
  if (text === "🆕 CREATE ACCOUNT")
    return send(chatId, "নিচের বাটনে ওয়েবসাইটে অ্যাকাউন্ট খুলুন, তারপর এখানে ফিরে 🔐 LOGIN করুন।", {
      inline_keyboard: [[{ text: "🆕 Create account", url: `${SITE_URL}/auth?mode=register${st.data?.pending_referrer_id ? `&ref=${encodeURIComponent(st.data.pending_referrer_id)}` : ""}` }]],
    });
  if (text === "🔐 LOGIN" || text === "/login") {
    await setState(chatId, "login_email");
    return send(chatId, "ওয়েবসাইটে নিবন্ধিত <b>Email address</b> লিখুন। আপনার ইমেইলে verification code পাঠানো হবে:", { remove_keyboard: true });
  }
  if (st.state === "login_email" && text) {
    const email = text.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) return send(chatId, "❌ সঠিক email address দিন।");
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";
    if (!process.env["SUPABASE_URL"] || !key) return send(chatId, "⚠️ Login service এখন কনফিগার করা নেই। পরে আবার চেষ্টা করুন।");
    const pub = createClient(process.env["SUPABASE_URL"]!, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await pub.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (error) {
      console.error("Telegram OTP request failed", error.message);
      await setState(chatId, "");
      return send(chatId, "❌ ইমেইলে code পাঠানো যায়নি। ইমেইলটি registered কি না দেখুন, তারপর আবার LOGIN করুন।", GUEST_AUTH);
    }
    await setState(chatId, "login_otp", { email, otp_requested_at: Date.now() });
    return send(chatId, "📩 <b>Verification code পাঠানো হয়েছে</b>\\n\\nইমেইল: <code>" + esc(email) + "</code>\\n\\nইমেইলে আসা code এখানে লিখুন। Code কাউকে দেবেন না। বাতিল করতে /cancel লিখুন।");
  }
  if (st.state === "login_otp" && text) {
    if (text === "/cancel") { await setState(chatId, ""); return send(chatId, "Login বাতিল হয়েছে। আবার LOGIN চাপুন।", GUEST_AUTH); }
    const email = String(st.data?.email ?? "");
    const code = text.replace(/\s+/g, "");
    if (!email || !/^(?:\d{6}|\d{8})$/.test(code)) return send(chatId, "❌ ইমেইলে আসা 6 বা 8 সংখ্যার verification code লিখুন।");
    await tg("deleteMessage", { chat_id: chatId, message_id: m.message_id }).catch(() => undefined);
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";
    const pub = createClient(process.env["SUPABASE_URL"]!, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await pub.auth.verifyOtp({ email, token: code, type: "email" });
    if (error || !data.user) { console.error("Telegram OTP verification failed", error?.message); return send(chatId, "❌ Code ভুল বা মেয়াদ শেষ। সঠিক code আবার দিন, অথবা /cancel লিখে নতুন code নিন।"); }
    const db = await admin();
    await db.from("telegram_links").delete().or("user_id.eq." + data.user.id + ",telegram_user_id.eq." + m.from.id);
    const { error: linkError } = await db.from("telegram_links").insert({ user_id: data.user.id, telegram_user_id: m.from.id, telegram_chat_id: chatId, telegram_username: m.from.username ?? null });
    if (linkError) { console.error("Telegram account link failed", linkError); await setState(chatId, ""); return send(chatId, "❌ Email verify হয়েছে, কিন্তু Telegram account link করা যায়নি। Admin-কে জানান।"); }
    await setState(chatId, "");
    const linked = await linkedUser(m.from.id);
    await notifyOwner("🔗 Telegram linked: <b>" + esc(linked?.username || email) + "</b> (@" + esc(m.from.username ?? m.from.id) + ")");
    return welcome(chatId, linked);
  }

  if (!user) return welcome(chatId, null);
  if (text === "/logout") {
    const db = await admin();
    await db.from("telegram_links").delete().eq("telegram_user_id", m.from.id);
    return send(chatId, "Logout হয়েছে।", GUEST_AUTH);
  }
  switch (text) {
    case "🛍 Products": return showProducts(chatId);
    case "💰 Wallet": return showWallet(chatId, user);
    case "➕ Add Fund":
      return send(chatId, `💰 বর্তমান ব্যালেন্স: <b>${tk(user.balance)}</b>\nনিচে Add Fund চাপুন।`, {
        inline_keyboard: [[{ text: "➕ Add Fund", callback_data: "menu:fund" }], [{ text: "⬅️ Back", callback_data: "menu:home" }]],
      });
    case "📦 Orders": return showOrders(chatId, user, false);
    case "🔑 Keys": return showOrders(chatId, user, true);
    case "👤 Profile":
      return send(chatId, `👤 <b>Profile</b>\nনাম: ${esc(user.name)}\nUsername: ${esc(user.username)}\nEmail: ${esc(user.email)}\nPhone: ${esc(user.phone)}\nব্যালেন্স: <b>${tk(user.balance)}</b>\n\nLogout: /logout`);
    case "📞 Support": return showSupport(chatId);
    case "🌐 Website": return send(chatId, "🌐 ওয়েবসাইট:", { inline_keyboard: [[{ text: "Open website", url: SITE_URL }]] });
    default: return welcome(chatId, user);
  }
}

async function showFundAmounts(chatId: number, user: any, method = "", messageId?: number) {
  const balanceLine = `💳 Current Balance: ${dualMoney(user.balance)}\n\n━━━━━━━━━━━━━━━━━━━━━━\n💳 Available Payment Methods:\n🇧🇩 Bangladeshi payment (bKash/Nagad)\n\n✅ Use balance for purchases!\n━━━━━━━━━━━━━━━━━━━━━━`;
  if (!method) return screen(chatId, messageId, `💰 ━━ <b>ADD BALANCE</b> ━━ 💰\n\n${balanceLine}\n\nSelect amount to deposit.\nChoose your payment method next:`, {
    inline_keyboard: [
      [{ text: "৳100", callback_data: "fundshort:100" }, { text: "৳200", callback_data: "fundshort:200" }, { text: "৳500", callback_data: "fundshort:500" }],
      [{ text: "৳1000", callback_data: "fundshort:1000" }, { text: "৳2000", callback_data: "fundshort:2000" }],
      [{ text: "⬅️ Back to Main Menu", callback_data: "menu:home" }],
    ],
  });
  const amount = Number((method.match(/\d+/) ?? ["100"])[0]);
  return screen(chatId, messageId, `💰 ━━ <b>ADD BALANCE</b> ━━ 💰\n\n${balanceLine}\n\nAmount: <b>${tk(amount)}</b>\nPayment method বেছে নিন:`, {
    inline_keyboard: [
      [{ text: "🇧🇩 Bangladeshi payment (bKash/Nagad)", callback_data: `fundpay:uddokta:${amount}` }],
      [{ text: "⬅️ Back to amounts", callback_data: "menu:fund" }],
    ],
  });
}
async function startTelegramPayment(chatId: number, user: any, amount: number, method = "UddoktaPay", messageId?: number) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { paymentBaseUrl } = await import("@/lib/uddoktapay.server");
  const apiKey = process.env["UDDOKTAPAY_API_KEY"];
  if (!apiKey) return screen(chatId, messageId, "⚠️ Payment gateway এখন কনফিগার করা নেই। Admin-এর সাথে যোগাযোগ করুন।", { inline_keyboard: [[{ text: "⬅️ Back", callback_data: "menu:fund" }]] });
  const ref = crypto.randomUUID();
  const { error: insErr } = await supabaseAdmin.from("uddoktapay_payments").insert({
    id: ref, user_id: user.id, invoice_id: `pending-${ref}`, amount, status: "pending",
  });
  if (insErr) return screen(chatId, messageId, "❌ Payment request তৈরি হয়নি। আবার চেষ্টা করুন।");
  const origin = SITE_URL.replace(/\/$/, "");
  const res = await fetch(`${paymentBaseUrl()}/checkout-v2`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "RT-UDDOKTAPAY-API-KEY": apiKey },
    body: JSON.stringify({
      full_name: user.name || user.username || "Customer",
      email: user.email || "customer@example.com",
      amount: String(amount),
      metadata: { user_id: user.id, ref, source: "telegram", method },
      redirect_url: `${origin}/payment/success`,
      return_type: "GET",
      cancel_url: `${origin}/payment/cancel`,
      webhook_url: `${origin}/api/public/uddoktapay/webhook`,
    }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.payment_url) {
    await supabaseAdmin.from("uddoktapay_payments").update({ status: "failed", raw: body }).eq("id", ref);
    console.error("Telegram UddoktaPay checkout failed", res.status, body);
    return screen(chatId, messageId, "❌ Payment link তৈরি হয়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।", { inline_keyboard: [[{ text: "↩️ Try again", callback_data: `fundamount:${amount}` }], [{ text: "⬅️ Back", callback_data: "menu:fund" }]] });
  }
  await supabaseAdmin.from("uddoktapay_payments").update({ raw: body }).eq("id", ref);
  return screen(chatId, messageId, `🧾 <b>PAYMENT SUMMARY</b>\n\nAmount: <b>${tk(amount)}</b>\nPayment: <b>${esc(method)}</b>\nStatus: Pending\n\nনিচের বাটনে চাপ দিলে UddoktaPay checkout Telegram-এর ভেতরে খুলবে (Telegram client সমর্থন করলে)। Payment successful হলে wallet অটো credit হবে।`, {
    inline_keyboard: [[{ text: "💳 Pay now", web_app: { url: body.payment_url } }], [{ text: "🔗 Open payment", url: body.payment_url }], [{ text: "⬅️ Back", callback_data: "menu:fund" }]],
  });
}

async function showProducts(chatId: number, messageId?: number) {
  const db = await admin();
  const { data } = await db.from("products").select("id,name").eq("is_active", true).order("sort_order").limit(60);
  const rows = (data ?? []).map((p: any) => [{ text: p.name, callback_data: `p:${p.id}` }]);
  rows.push([{ text: "⬅️ Back to Main Menu", callback_data: "menu:home" }]);
  const body = { chat_id: chatId, text: data?.length ? "🛍 <b>Products</b> — একটি বেছে নিন:" : "এখন কোনো প্রোডাক্ট নেই।", parse_mode: "HTML", disable_web_page_preview: true, reply_markup: { inline_keyboard: rows } };
  return screen(chatId, messageId, body.text, body.reply_markup);
}

async function showWallet(chatId: number, user: any, messageId?: number) {
  const db = await admin();
  const { data } = await db.from("wallet_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(8);
  const lines = (data ?? []).map((t: any) => `${t.amount > 0 ? "➕" : "➖"} ${tk(Math.abs(t.amount))} · ${esc(t.description ?? t.type)}`);
  return screen(chatId, messageId, `💰 ব্যালেন্স: <b>${tk(user.balance)}</b>\n\n${lines.join("\n") || "কোনো লেনদেন নেই।"}`, { inline_keyboard: [[{ text: "⬅️ Back to Main Menu", callback_data: "menu:home" }]] });
}

async function showOrders(chatId: number, user: any, keysOnly: boolean, messageId?: number) {
  const db = await admin();
  let q = db.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10);
  if (keysOnly) q = q.not("delivered_key", "is", null);
  const { data } = await q;
  if (!data?.length) return screen(chatId, messageId, keysOnly ? "কোনো Key নেই।" : "কোনো অর্ডার নেই।", { inline_keyboard: [[{ text: "⬅️ Back to Main Menu", callback_data: "menu:home" }]] });
  const out = data.map((o: any) => `#${o.id.slice(0, 8)} · <b>${esc(o.product_name)}</b>\n${tk(o.total)} · ${esc(o.status)} · ${new Date(o.created_at).toLocaleDateString("en-GB")}${o.delivered_key ? `\n🔑 <code>${esc(o.delivered_key)}</code>` : ""}`);
  return screen(chatId, messageId, (keysOnly ? "🔑 <b>My Keys</b>\n\n" : "📦 <b>My Orders</b>\n\n") + out.join("\n\n"), { inline_keyboard: [[{ text: "⬅️ Back to Main Menu", callback_data: "menu:home" }]] });
}

async function showSupport(chatId: number, messageId?: number) {
  const db = await admin();
  const { data } = await db.from("site_settings").select("key,value").in("key", ["telegram_username"]);
  const s: Record<string, string> = {};
  for (const r of data ?? []) s[r.key] = r.value;
  const buttons: any[] = [];
  if (s["telegram_username"]) buttons.push([{ text: "👤 Telegram Admin", url: `https://t.me/${s["telegram_username"].replace(/^@/, "")}` }]);
  buttons.push([{ text: "🎫 Open Support Ticket — Quick Reply", callback_data: "menu:supportticket" }]);
  buttons.push([{ text: "🌐 OPEN WEBSITE — panelbazarbd.shop", url: "https://panelbazarbd.shop" }]);
  buttons.push([{ text: "⬅️ Back to Main Menu", callback_data: "menu:home" }]);
  return screen(chatId, messageId, "💬 <b>SUPPORT CENTER</b>\n\nAdmin-এর সাথে যোগাযোগ করুন অথবা Quick Reply Support Ticket খুলুন। সমস্যার বিবরণ এবং সম্ভব হলে screenshot/photo পাঠান।", { inline_keyboard: buttons });
}

async function handleCallback(cq: any) {
  const chatId = cq.message?.chat?.id as number;
  await tg("answerCallbackQuery", { callback_query_id: cq.id });
  if (!chatId) return;
  const user = await linkedUser(cq.from.id);
  const [kind, id] = String(cq.data ?? "").split(":");
  const ownerChatId = process.env["TELEGRAM_OWNER_CHAT_ID"];
  if ((kind === "supportreply" || kind === "supportclose") && String(chatId) === String(ownerChatId ?? "")) {
    const db = await admin();
    const { data: ticket } = await db.from("support_tickets").select("id,user_id,subject,telegram_chat_id,status").eq("id", id).eq("status", "open").maybeSingle();
    if (!ticket) return screen(chatId, cq.message?.message_id, "টিকিটটি আগেই বন্ধ হয়েছে বা পাওয়া যায়নি।");
    if (kind === "supportreply") {
      await setState(chatId, "admin_support_reply", { support_ticket_id: ticket.id });
      return screen(chatId, cq.message?.message_id, `↩️ <b>Reply লিখুন</b>\nTicket: <code>${esc(ticket.id)}</code>\nUser: <code>${esc(ticket.user_id)}</code>\n\nএখন আপনার উত্তর পাঠান। বাতিল করতে /cancel লিখুন।`);
    }
    await db.from("support_tickets").update({ status: "resolved", updated_at: new Date().toISOString() }).eq("id", ticket.id);
    const { data: link } = await db.from("telegram_links").select("telegram_chat_id").eq("user_id", ticket.user_id).maybeSingle();
    const customerChat = ticket.telegram_chat_id ?? link?.telegram_chat_id;
    if (customerChat) await send(Number(customerChat), `✅ আপনার Support Ticket <code>${esc(ticket.id)}</code> admin বন্ধ করেছেন। প্রয়োজন হলে নতুন টিকিট খুলুন।`);
    return screen(chatId, cq.message?.message_id, `✅ <b>Ticket resolved</b>\n<code>${esc(ticket.id)}</code>`);
  }
  if (kind === "guest") {
    const st = await getState(chatId);
    if (st.data?.phone_shared !== true) return welcome(chatId, null);
    if (id === "login") {
      await setState(chatId, "login_email");
      return screen(chatId, cq.message?.message_id, "ওয়েবসাইটে নিবন্ধিত <b>Email address</b> লিখুন। আপনার ইমেইলে verification code পাঠানো হবে:");
    }
    if (id === "register") return screen(chatId, cq.message?.message_id, "নিচের বাটনে ওয়েবসাইটে অ্যাকাউন্ট খুলুন, তারপর এখানে ফিরে 🔐 LOGIN করুন।", {
      inline_keyboard: [[{ text: "🆕 Create account", url: `${SITE_URL}/auth?mode=register${st.data?.pending_referrer_id ? `&ref=${encodeURIComponent(st.data.pending_referrer_id)}` : ""}` }]],
    });
  }
  if (!user) return welcome(chatId, null);
  const db = await admin();
  if (kind === "menu") {
    if (id === "products") return showProducts(chatId, cq.message?.message_id);
    if (id === "wallet") return showWallet(chatId, user, cq.message?.message_id);
    if (id === "fund") return showFundAmounts(chatId, user, "", cq.message?.message_id);
    if (id.startsWith("fundmethod-")) return showFundAmounts(chatId, user, id.endsWith("bkash") ? "bKash / UddoktaPay" : id.endsWith("nagad") ? "Nagad / UddoktaPay" : "UddoktaPay", cq.message?.message_id);
    if (id === "orders") return showOrders(chatId, user, false, cq.message?.message_id);
    if (id === "keys") return showOrders(chatId, user, true, cq.message?.message_id);
    if (id === "support") return showSupport(chatId, cq.message?.message_id);
    if (id === "referral") {
      const { data: rows, error } = await db.from("referrals").select("id").eq("referrer_id", user.id);
      const referralCount = error ? 0 : (rows ?? []).length;
      const referralLink = `https://t.me/${"panelbazarbd_bot"}?start=ref_${encodeURIComponent(user.id)}`;
      const text = `🤝 <b>REFERRAL PROGRAM</b>\n\n👥 Successful referrals: <b>${referralCount}</b>\n\n🔗 <b>Your personal Telegram link:</b>\n${esc(referralLink)}\n\nবন্ধুকে এই link পাঠান। সে link দিয়ে bot-এ Start চাপবে, নিজের নম্বর share করবে এবং website account তৈরি করে email verify করলে referral গণনা হবে।`;
      return screen(chatId, cq.message?.message_id, text, { inline_keyboard: [[{ text: "📋 Open Website Referral Page", url: "https://panelbazarbd.shop/dashboard/referral" }], [{ text: "🌐 Open Website", url: "https://panelbazarbd.shop" }], [{ text: "⬅️ Back to Main Menu", callback_data: "menu:home" }]] });
    }
    if (id === "supportticket") {
      await setState(chatId, "support_ticket_details", { support_user_id: user.id, support_message_id: cq.message?.message_id });
      return screen(chatId, cq.message?.message_id, "🎫 <b>OPEN SUPPORT TICKET</b>\n\nআপনার সমস্যার বিস্তারিত লিখে পাঠান। সম্ভব হলে একই মেসেজে photo/screenshot যোগ করুন। শুধু text বা photo caption-সহ photo পাঠালেও হবে।\n\nCancel করতে /cancel লিখুন।", { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "menu:support" }]] });
    }
    if (id === "logout") {
      await db.from("telegram_links").delete().eq("telegram_user_id", cq.from.id);
      await setState(chatId, "guest_auth", { phone_shared: true });
      return screen(chatId, cq.message?.message_id, "✅ আপনার Telegram account থেকে Logout হয়েছে। আবার ব্যবহার করতে LOGIN করুন।", GUEST_AUTH);
    }
    if (id === "profile") {
      const [ordersResult, spentResult, referralResult] = await Promise.all([
        db.from("orders").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        db.from("orders").select("total").eq("user_id", user.id).in("status", ["completed", "delivered", "success"]),
        db.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", user.id),
      ]);
      const orderCount = ordersResult.count ?? 0;
      const spent = (spentResult.data ?? []).reduce((sum: number, row: any) => sum + Number(row.total ?? 0), 0);
      const joined = user.created_at ? new Date(user.created_at).toLocaleString("sv-SE", { timeZone: "Asia/Dhaka" }).replace("T", " ") : "—";
      const account = user.is_admin ? "👑 Admin" : "🧑‍💼 Regular";
      const profileText = `👤 ━━ <b>YOUR PROFILE</b> ━━ 👤\n\n🆔 User ID: <code>${cq.from.id}</code>\n📛 Name: ${esc(user.name || user.username || "—")}\n📧 Email: ${esc(user.email || "Not added")}\n📱 Number: ${esc(user.phone || "Not added")}\n👑 Account: ${account}\n\n💰 ━ <b>Balance</b> ━\n   💳 Current: ${dualMoney(user.balance)}\n\n📊 ━ <b>Statistics</b> ━\n   📦 Orders: ${orderCount}\n   💸 Spent: ${dualMoney(spent)}\n   👥 Referrals: ${referralResult.count ?? 0}\n\n📅 Joined: ${joined}`;
      return screen(chatId, cq.message?.message_id, profileText, { inline_keyboard: [[{ text: "🚪 Logout", callback_data: "menu:logout" }], [{ text: "⬅️ Back to Main Menu", callback_data: "menu:home" }]] });
    }
    if (id === "home") return welcome(chatId, user, cq.message?.message_id);
  }
  if (kind === "fundshort" && id) {
    const amount = Number(id);
    if (!(amount >= 1 && amount <= 100000)) return screen(chatId, cq.message?.message_id, "সঠিক amount নির্বাচন করুন।");
    return screen(chatId, cq.message?.message_id, `💰 ━━ <b>ADD BALANCE</b> ━━ 💰\nAmount: <b>${tk(amount)}</b>\nPayment method বেছে নিন:`, {
      inline_keyboard: [[{ text: "🇧🇩 Bangladeshi payment (bKash/Nagad)", callback_data: `fundpay:uddokta:${amount}` }], [{ text: "⬅️ Back to amounts", callback_data: "menu:fund" }]],
    });
  }
  if (kind === "fundmethod" && id) {
    const method = id === "bkash" ? "bKash / UddoktaPay" : id === "nagad" ? "Nagad / UddoktaPay" : "UddoktaPay";
    return showFundAmounts(chatId, user, method, cq.message?.message_id);
  }
  if (kind === "fundpay" && id) {
    const [, methodId, rawAmount] = String(cq.data ?? "").split(":");
    const amount = Number(rawAmount);
    const method = "Bangladeshi payment (bKash/Nagad)";
    if (methodId !== "uddokta") return screen(chatId, cq.message?.message_id, "সঠিক payment method নির্বাচন করুন।");
    if (!(amount >= 1 && amount <= 100000)) return screen(chatId, cq.message?.message_id, "সঠিক amount নির্বাচন করুন।");
    return startTelegramPayment(chatId, user, amount, method, cq.message?.message_id);
  }
    if (kind === "p" && id) {
    const { data: p } = await db.from("products").select("name,short_description").eq("id", id).maybeSingle();
    const { data: pk } = await db.from("product_packages").select("id,name,price").eq("product_id", id).eq("is_active", true).order("sort_order");
    const { data: stock } = await db.rpc("package_stock", { p_product_id: id });
    const avail = new Map<string, number>((stock ?? []).map((s: any) => [s.package_id, Number(s.available)]));
    if (!pk?.length) return screen(chatId, cq.message?.message_id, "এই প্রোডাক্টে কোনো প্যাকেজ নেই।");
    return screen(chatId, cq.message?.message_id, `<b>${esc(p?.name)}</b>\n${esc(p?.short_description ?? "")}\n\nপ্যাকেজ বেছে নিন:`, {
      inline_keyboard: pk.map((k: any) => [{
        text: `${k.name} — ${Number(k.price) > 0 ? tk(k.price) : "Price not set"}${(avail.get(k.id) ?? 0) > 0 ? "" : " (শেষ)"}`,
        callback_data: `k:${k.id}`,
      }]),
    });
  }
  if (kind === "k" && id) {
    const { data: k } = await db.from("product_packages").select("id,name,price,products(name)").eq("id", id).maybeSingle();
    if (!k) return;
    return screen(chatId, cq.message?.message_id, `কিনবেন?\n<b>${esc(k.products?.name)} — ${esc(k.name)}</b>\nদাম: <b>${tk(k.price)}</b>\nব্যালেন্স: ${tk(user.balance)}`, {
      inline_keyboard: [[{ text: "✅ Buy now", callback_data: `b:${k.id}` }]],
    });
  }
  if (kind === "b" && id) {
    const { data: oid, error } = await db.rpc("bot_purchase_package", { p_user_id: user.id, p_package_id: id });
    if (error) {
      if (error.message.includes("INSUFFICIENT")) {
        const { data: k } = await db.from("product_packages").select("price").eq("id", id).maybeSingle();
        const shortfall = Math.max(1, Math.ceil(Number(k?.price ?? 100) - Number(user.balance ?? 0)));
        return screen(chatId, cq.message?.message_id, `❌ ব্যালেন্স যথেষ্ট নয়।\nপ্রয়োজন: ${tk(k?.price ?? 0)}\nআপনার ব্যালেন্স: ${tk(user.balance)}\n\nAdd Fund amount: ${tk(shortfall)}`, {
          inline_keyboard: [[{ text: `➕ Add ${tk(shortfall)}`, callback_data: `fundshort:${shortfall}` }], [{ text: "💳 Add Fund options", callback_data: "menu:fund" }], [{ text: "⬅️ Back", callback_data: "menu:products" }]],
        });
      }
      const msg = error.message.includes("NO_KEYS") ? "এই প্যাকেজের Key বর্তমানে শেষ।"
        : `❌ ${error.message}`;
      return screen(chatId, cq.message?.message_id, msg);
    }
    const { data: o } = await db.from("orders").select("*").eq("id", oid).maybeSingle();
    await notifyOwner(`🛒 Telegram purchase\nUser: <b>${esc(user.username || user.email)}</b>\n${esc(o?.product_name)}\n${tk(o?.total ?? 0)} · Order #${String(oid).slice(0, 8)}`);
    return screen(chatId, cq.message?.message_id, `✅ কেনা সফল!\n<b>${esc(o?.product_name)}</b>\n🔑 Key: <code>${esc(o?.delivered_key)}</code>\nOrder #${String(oid).slice(0, 8)}`, MENU);
  }
}
