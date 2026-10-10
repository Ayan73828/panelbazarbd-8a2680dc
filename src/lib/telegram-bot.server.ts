// Server-only Telegram bot logic. Uses the same database as the website.
import { notifyOwner } from "@/lib/uddoktapay.server";

export const SITE_URL = process.env["SITE_URL"] || "https://panelbazarbd-8a2680dc.onrender.com";

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

const MENU = {
  inline_keyboard: [
    [{ text: "🛍 SHOP NOW", callback_data: "menu:products" }, { text: "💰 MY WALLET", callback_data: "menu:wallet" }],
    [{ text: "➕ ADD FUND", callback_data: "menu:fund" }, { text: "📦 ORDERS", callback_data: "menu:orders" }],
    [{ text: "🔑 MY KEYS", callback_data: "menu:keys" }, { text: "👤 PROFILE", callback_data: "menu:profile" }],
    [{ text: "📞 SUPPORT", callback_data: "menu:support" }, { text: "🌐 WEBSITE", url: SITE_URL }],
  ],
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
const send = async (chat_id: number, text: string, reply_markup?: unknown) => {
  const result = await tg("sendMessage", { chat_id, text, parse_mode: "HTML", disable_web_page_preview: true, ...(reply_markup ? { reply_markup } : {}) });
  const id = result?.result?.message_id;
  if (typeof id === "number") await rememberMessage(chat_id, id).catch((e) => console.error("telegram message tracking", e));
  return result;
};

async function welcome(chatId: number, user: any) {
  if (user) {
    await send(chatId, `🏪 ━━ <b>Panel Bazar BD</b> ━━ 🏪\n\n👋 Welcome back, <b>${esc(user.name || user.username || "Customer")}</b>\n\n⭐ ━ <b>REGULAR HIGHLIGHTS</b> ━ ⭐\n\n│ 🔑 Wholesale Game Keys &amp; VIP Stocks\n│ ⚡ Priority Auto-Delivery 24/7\n│ 🎁 Tiered Referral\n│ 📞 Dedicated VIP Partner Support\n\n━━━━━━━━━━━━━━━━━━━━━\n\n🚀 <b>Tap Shop Now to Start!</b>`, { inline_keyboard: [[{ text: "Restart 🔁", callback_data: "start:restart" }]] });
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

  if (text.startsWith("/start")) {
    const oldIds = Array.isArray(st.data?.recent_bot_message_ids) ? st.data.recent_bot_message_ids : [];
    for (const message_id of oldIds) await tg("deleteMessage", { chat_id: chatId, message_id }).catch(() => undefined);
    await setState(chatId, st.data?.phone_shared ? (user ? "" : "guest_auth") : (user ? "" : "guest_share_number"), { recent_bot_message_ids: [] });
    if (user) return welcome(chatId, user);
    if (st.data?.phone_shared) return send(chatId, "✅ নম্বর আগে থেকেই শেয়ার করা আছে। এখন LOGIN করুন অথবা CREATE ACCOUNT করুন।", GUEST_AUTH);
    return send(chatId, "👋 <b>PANEL BAZAR BD</b> এ স্বাগতম!\n\nশুরু করতে নিচের SHARE MY NUMBER বাটনে চাপ দিন।", SHARE_NUMBER);
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
      inline_keyboard: [[{ text: "🆕 Create account", url: `${SITE_URL}/auth?mode=register` }]],
    });
  if (text === "🔐 LOGIN" || text === "/login") {
    await setState(chatId, "login_id");
    return send(chatId, "আপনার ওয়েবসাইটের <b>Username বা Email</b> লিখুন:", { remove_keyboard: true });
  }
  if (st.state === "login_id" && text) {
    await setState(chatId, "login_pw", { id: text.slice(0, 200) });
    return send(chatId, "এখন <b>Password</b> লিখুন (মেসেজটি সাথে সাথে মুছে ফেলা হবে):");
  }
  if (st.state === "login_pw" && text) {
    await tg("deleteMessage", { chat_id: chatId, message_id: m.message_id });
    await setState(chatId, "");
    return doLogin(chatId, m.from, String(st.data?.id ?? ""), text);
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

async function doLogin(chatId: number, from: any, id: string, password: string) {
  const db = await admin();
  let email = id;
  if (!id.includes("@")) {
    const { data } = await db.rpc("resolve_login_email", { p_username: id });
    email = data ?? "";
  }
  if (!email) return send(chatId, "❌ Username/Email বা Password ভুল। আবার 🔐 LOGIN চাপুন।", GUEST_AUTH);
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";
  const pub = createClient(process.env["SUPABASE_URL"]!, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await pub.auth.signInWithPassword({ email, password });
  if (error || !data.user) return send(chatId, "❌ Username/Email বা Password ভুল। আবার 🔐 LOGIN চাপুন।", GUEST_AUTH);
  await db.from("telegram_links").delete().or(`user_id.eq.${data.user.id},telegram_user_id.eq.${from.id}`);
  await db.from("telegram_links").insert({ user_id: data.user.id, telegram_user_id: from.id, telegram_chat_id: chatId, telegram_username: from.username ?? null });
  const user = await linkedUser(from.id);
  await notifyOwner(`🔗 Telegram linked: <b>${esc(user?.username || email)}</b> (@${esc(from.username ?? from.id)})`);
  return welcome(chatId, user);
}

async function showFundAmounts(chatId: number, user: any, method = "") {
  if (!method) return send(chatId, `💰 <b>ADD FUND</b>\nবর্তমান ব্যালেন্স: <b>${tk(user.balance)}</b>\n\nPayment method বেছে নিন:`, {
    inline_keyboard: [
      [{ text: "📱 bKash", callback_data: "menu:fundmethod-bkash" }, { text: "📱 Nagad", callback_data: "menu:fundmethod-nagad" }],
      [{ text: "💳 UddoktaPay", callback_data: "menu:fundmethod-uddokta" }],
      [{ text: "⬅️ Back", callback_data: "menu:home" }],
    ],
  });
  const methodId = method.startsWith("bKash") ? "bkash" : method.startsWith("Nagad") ? "nagad" : "uddokta";
  return send(chatId, `💰 <b>ADD FUND</b>\nPayment: <b>${esc(method)}</b>\nবর্তমান ব্যালেন্স: <b>${tk(user.balance)}</b>\n\nAmount বেছে নিন:`, {
    inline_keyboard: [
      [{ text: "৳100", callback_data: `fundpay:${methodId}:100` }, { text: "৳500", callback_data: `fundpay:${methodId}:500` }, { text: "৳1000", callback_data: `fundpay:${methodId}:1000` }],
      [{ text: "৳2000", callback_data: `fundpay:${methodId}:2000` }, { text: "✍️ Custom amount", url: `${SITE_URL}/dashboard/wallet` }],
      [{ text: "⬅️ Back", callback_data: "menu:fund" }],
    ],
  });
}
async function startTelegramPayment(chatId: number, user: any, amount: number, method = "UddoktaPay") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { paymentBaseUrl } = await import("@/lib/uddoktapay.server");
  const apiKey = process.env["UDDOKTAPAY_API_KEY"];
  if (!apiKey) return send(chatId, "⚠️ Payment gateway এখন কনফিগার করা নেই। Admin-এর সাথে যোগাযোগ করুন।", { inline_keyboard: [[{ text: "⬅️ Back", callback_data: "menu:fund" }]] });
  const ref = crypto.randomUUID();
  const { error: insErr } = await supabaseAdmin.from("uddoktapay_payments").insert({
    id: ref, user_id: user.id, invoice_id: `pending-${ref}`, amount, status: "pending",
  });
  if (insErr) return send(chatId, "❌ Payment request তৈরি হয়নি। আবার চেষ্টা করুন।");
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
    return send(chatId, "❌ Payment link তৈরি হয়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।", { inline_keyboard: [[{ text: "↩️ Try again", callback_data: `fundamount:${amount}` }], [{ text: "⬅️ Back", callback_data: "menu:fund" }]] });
  }
  await supabaseAdmin.from("uddoktapay_payments").update({ raw: body }).eq("id", ref);
  return send(chatId, `🧾 <b>PAYMENT SUMMARY</b>\n\nAmount: <b>${tk(amount)}</b>\nPayment: <b>${esc(method)}</b>\nStatus: Pending\n\nনিচের বাটনে চাপ দিলে UddoktaPay checkout Telegram-এর ভেতরে খুলবে (Telegram client সমর্থন করলে)। Payment successful হলে wallet অটো credit হবে।`, {
    inline_keyboard: [[{ text: "💳 Pay now", web_app: { url: body.payment_url } }], [{ text: "🔗 Open payment", url: body.payment_url }], [{ text: "⬅️ Back", callback_data: "menu:fund" }]],
  });
}

async function showProducts(chatId: number) {
  const db = await admin();
  const { data } = await db.from("products").select("id,name").eq("is_active", true).order("sort_order").limit(60);
  if (!data?.length) return send(chatId, "এখন কোনো প্রোডাক্ট নেই।");
  return send(chatId, "🛍 <b>Products</b> — একটি বেছে নিন:", {
    inline_keyboard: data.map((p: any) => [{ text: p.name, callback_data: `p:${p.id}` }]),
  });
}

async function showWallet(chatId: number, user: any) {
  const db = await admin();
  const { data } = await db.from("wallet_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(8);
  const lines = (data ?? []).map((t: any) => `${t.amount > 0 ? "➕" : "➖"} ${tk(Math.abs(t.amount))} · ${esc(t.description ?? t.type)}`);
  return send(chatId, `💰 ব্যালেন্স: <b>${tk(user.balance)}</b>\n\n${lines.join("\n") || "কোনো লেনদেন নেই।"}`);
}

async function showOrders(chatId: number, user: any, keysOnly: boolean) {
  const db = await admin();
  let q = db.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10);
  if (keysOnly) q = q.not("delivered_key", "is", null);
  const { data } = await q;
  if (!data?.length) return send(chatId, keysOnly ? "কোনো Key নেই।" : "কোনো অর্ডার নেই।");
  const out = data.map((o: any) => `#${o.id.slice(0, 8)} · <b>${esc(o.product_name)}</b>\n${tk(o.total)} · ${esc(o.status)} · ${new Date(o.created_at).toLocaleDateString("en-GB")}${o.delivered_key ? `\n🔑 <code>${esc(o.delivered_key)}</code>` : ""}`);
  return send(chatId, (keysOnly ? "🔑 <b>My Keys</b>\n\n" : "📦 <b>My Orders</b>\n\n") + out.join("\n\n"));
}

async function showSupport(chatId: number) {
  const db = await admin();
  const { data } = await db.from("site_settings").select("key,value").in("key", ["telegram_username", "whatsapp_number", "contact_phone"]);
  const s: Record<string, string> = {};
  for (const r of data ?? []) s[r.key] = r.value;
  const btns: any[] = [];
  if (s["telegram_username"]) btns.push([{ text: "Telegram", url: `https://t.me/${s["telegram_username"].replace(/^@/, "")}` }]);
  if (s["whatsapp_number"]) btns.push([{ text: "WhatsApp", url: `https://wa.me/${s["whatsapp_number"].replace(/\D/g, "").replace(/^0/, "880")}` }]);
  return send(chatId, "📞 সাপোর্টের জন্য যোগাযোগ করুন:", btns.length ? { inline_keyboard: btns } : undefined);
}

async function handleCallback(cq: any) {
  const chatId = cq.message?.chat?.id as number;
  await tg("answerCallbackQuery", { callback_query_id: cq.id });
  if (!chatId) return;
  const user = await linkedUser(cq.from.id);
  const [kind, id] = String(cq.data ?? "").split(":");
  if (kind === "start" && id === "restart") {
    if (!user) return welcome(chatId, null);
    return send(chatId, "🏪 <b>Panel Bazar BD</b> — Main Menu", MENU);
  }
  if (kind === "guest") {
    const st = await getState(chatId);
    if (st.data?.phone_shared !== true) return welcome(chatId, null);
    if (id === "login") {
      await setState(chatId, "login_id");
      return send(chatId, "আপনার ওয়েবসাইটের <b>Username বা Email</b> লিখুন:");
    }
    if (id === "register") return send(chatId, "নিচের বাটনে ওয়েবসাইটে অ্যাকাউন্ট খুলুন, তারপর এখানে ফিরে 🔐 LOGIN করুন।", {
      inline_keyboard: [[{ text: "🆕 Create account", url: `${SITE_URL}/auth?mode=register` }]],
    });
  }
  if (!user) return welcome(chatId, null);
  const db = await admin();
  if (kind === "menu") {
    if (id === "products") return showProducts(chatId);
    if (id === "wallet") return showWallet(chatId, user);
    if (id === "fund") return showFundAmounts(chatId, user);
    if (id.startsWith("fundmethod-")) return showFundAmounts(chatId, user, id.endsWith("bkash") ? "bKash / UddoktaPay" : id.endsWith("nagad") ? "Nagad / UddoktaPay" : "UddoktaPay");
    if (id === "orders") return showOrders(chatId, user, false);
    if (id === "keys") return showOrders(chatId, user, true);
    if (id === "support") return showSupport(chatId);
    if (id === "profile") return send(chatId, `👤 <b>Profile</b>\nনাম: ${esc(user.name)}\nUsername: ${esc(user.username)}\nEmail: ${esc(user.email)}\nPhone: ${esc(user.phone)}\nব্যালেন্স: <b>${tk(user.balance)}</b>`, { inline_keyboard: [[{ text: "⬅️ Back", callback_data: "menu:home" }]] });
    if (id === "home") return welcome(chatId, user);
  }
  if (kind === "fundshort" && id) {
    const amount = Number(id);
    if (!(amount >= 1 && amount <= 100000)) return send(chatId, "সঠিক amount নির্বাচন করুন।");
    return send(chatId, `💳 <b>ADD FUND</b>\nAmount: <b>${tk(amount)}</b>\nPayment method বেছে নিন:`, {
      inline_keyboard: [[{ text: "📱 bKash", callback_data: `fundpay:bkash:${amount}` }, { text: "📱 Nagad", callback_data: `fundpay:nagad:${amount}` }], [{ text: "💳 UddoktaPay", callback_data: `fundpay:uddokta:${amount}` }], [{ text: "⬅️ Back", callback_data: "menu:fund" }]],
    });
  }
  if (kind === "fundmethod" && id) {
    const method = id === "bkash" ? "bKash / UddoktaPay" : id === "nagad" ? "Nagad / UddoktaPay" : "UddoktaPay";
    return showFundAmounts(chatId, user, method);
  }
  if (kind === "fundpay" && id) {
    const [, methodId, rawAmount] = String(cq.data ?? "").split(":");
    const amount = Number(rawAmount);
    const method = methodId === "bkash" ? "bKash / UddoktaPay" : methodId === "nagad" ? "Nagad / UddoktaPay" : "UddoktaPay";
    if (!(amount >= 1 && amount <= 100000)) return send(chatId, "সঠিক amount নির্বাচন করুন।");
    return startTelegramPayment(chatId, user, amount, method);
  }
  if (kind === "p" && id) {
    const { data: p } = await db.from("products").select("name,short_description").eq("id", id).maybeSingle();
    const { data: pk } = await db.from("product_packages").select("id,name,price").eq("product_id", id).eq("is_active", true).order("sort_order");
    const { data: stock } = await db.rpc("package_stock", { p_product_id: id });
    const avail = new Map<string, number>((stock ?? []).map((s: any) => [s.package_id, Number(s.available)]));
    if (!pk?.length) return send(chatId, "এই প্রোডাক্টে কোনো প্যাকেজ নেই।");
    return send(chatId, `<b>${esc(p?.name)}</b>\n${esc(p?.short_description ?? "")}\n\nপ্যাকেজ বেছে নিন:`, {
      inline_keyboard: pk.map((k: any) => [{
        text: `${k.name} — ${Number(k.price) > 0 ? tk(k.price) : "Price not set"}${(avail.get(k.id) ?? 0) > 0 ? "" : " (শেষ)"}`,
        callback_data: `k:${k.id}`,
      }]),
    });
  }
  if (kind === "k" && id) {
    const { data: k } = await db.from("product_packages").select("id,name,price,products(name)").eq("id", id).maybeSingle();
    if (!k) return;
    return send(chatId, `কিনবেন?\n<b>${esc(k.products?.name)} — ${esc(k.name)}</b>\nদাম: <b>${tk(k.price)}</b>\nব্যালেন্স: ${tk(user.balance)}`, {
      inline_keyboard: [[{ text: "✅ Buy now", callback_data: `b:${k.id}` }]],
    });
  }
  if (kind === "b" && id) {
    const { data: oid, error } = await db.rpc("bot_purchase_package", { p_user_id: user.id, p_package_id: id });
    if (error) {
      if (error.message.includes("INSUFFICIENT")) {
        const { data: k } = await db.from("product_packages").select("price").eq("id", id).maybeSingle();
        const shortfall = Math.max(1, Math.ceil(Number(k?.price ?? 100) - Number(user.balance ?? 0)));
        return send(chatId, `❌ ব্যালেন্স যথেষ্ট নয়।\nপ্রয়োজন: ${tk(k?.price ?? 0)}\nআপনার ব্যালেন্স: ${tk(user.balance)}\n\nAdd Fund amount: ${tk(shortfall)}`, {
          inline_keyboard: [[{ text: `➕ Add ${tk(shortfall)}`, callback_data: `fundshort:${shortfall}` }], [{ text: "💳 Add Fund options", callback_data: "menu:fund" }], [{ text: "⬅️ Back", callback_data: "menu:products" }]],
        });
      }
      const msg = error.message.includes("NO_KEYS") ? "এই প্যাকেজের Key বর্তমানে শেষ।"
        : `❌ ${error.message}`;
      return send(chatId, msg);
    }
    const { data: o } = await db.from("orders").select("*").eq("id", oid).maybeSingle();
    await notifyOwner(`🛒 Telegram purchase\nUser: <b>${esc(user.username || user.email)}</b>\n${esc(o?.product_name)}\n${tk(o?.total ?? 0)} · Order #${String(oid).slice(0, 8)}`);
    return send(chatId, `✅ কেনা সফল!\n<b>${esc(o?.product_name)}</b>\n🔑 Key: <code>${esc(o?.delivered_key)}</code>\nOrder #${String(oid).slice(0, 8)}`, MENU);
  }
}
