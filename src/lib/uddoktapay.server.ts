export async function privateSetting(key: string) { const { supabaseAdmin } = await import("@/integrations/supabase/client.server"); const { data } = await supabaseAdmin.from("admin_private_settings").select("value").eq("key", key).maybeSingle(); return data?.value || ""; }

// Server-only helpers for UddoktaPay (Paymently) auto deposits.
export async function paymentBaseUrl() {
  const configuredUrl = (await privateSetting("uddoktapay_base_url")) || process.env["UDDOKTAPAY_BASE_URL"];
  if (!configuredUrl) throw new Error("Payment gateway is not configured yet");

  // Accept a domain, an API root (/api), or a full endpoint
  // (/api/checkout-v2 or /api/verify-payment) from Render env settings.
  // Normalize all forms to the shared API root used by web and Telegram.
  const url = new URL(configuredUrl.trim().replace(/\/+$/, ""));
  let path = url.pathname.replace(/\/+$/, "");
  path = path.replace(/\/(?:checkout-v2|verify-payment)$/i, "");
  if (!path.endsWith("/api")) path = path ? `${path}/api` : "/api";
  url.pathname = path;
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/+$/, "");
}


export async function notifyOwner(text: string, replyMarkup?: Record<string, unknown>) {
  try {
    const token = (await privateSetting("telegram_bot_token")) || process.env["TELEGRAM_BOT_TOKEN"];
    const ownerChatId = (await privateSetting("telegram_chat_id")) || process.env["TELEGRAM_OWNER_CHAT_ID"];
    if (!token || !ownerChatId) {
      console.error("telegram notify skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_OWNER_CHAT_ID missing");
      return false;
    }
    if (!text.trim()) {
      console.error("telegram notify skipped: empty message");
      return false;
    }
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: ownerChatId, text, parse_mode: "HTML", disable_web_page_preview: true, ...(replyMarkup ? { reply_markup: replyMarkup } : {}) }),
    });
    const payload = await res.json().catch(() => null) as { ok?: boolean; description?: string; error_code?: number } | null;
    if (!res.ok || payload?.ok !== true) {
      console.error("telegram notify failed", res.status, payload?.error_code, payload?.description ?? "Unknown Telegram API error");
      return false;
    }
    return true;
  } catch (e) {
    console.error("telegram notify failed", e);
    return false;
  }
}

type Row = { id: string; user_id: string; invoice_id: string; amount: number; status: string };

export type VerifyOutcome = { status: "completed" | "pending" | "failed" | "cancelled"; amount: number; message?: string | undefined };

/**
 * Verify an invoice with the gateway and credit the wallet once.
 * The invoice id returned on redirect differs from the checkout token we stored,
 * so the payment row is matched via metadata.ref (our row id) when needed.
 * `onlyUserId` restricts matching to that user's rows (customer-initiated verify).
 */
export async function verifyAndCredit(invoiceId: string, onlyUserId?: string): Promise<VerifyOutcome> {
  const apiKey = (await privateSetting("uddoktapay_api_key")) || process.env["UDDOKTAPAY_API_KEY"];
  if (!apiKey) throw new Error("UddoktaPay is not configured yet");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const byInvoice = await supabaseAdmin.from("uddoktapay_payments").select("*").eq("invoice_id", invoiceId).maybeSingle();
  let row = byInvoice.data as Row | null;
  if (row && onlyUserId && row.user_id !== onlyUserId) throw new Error("Forbidden");
  if (row?.status === "completed") return { status: "completed", amount: Number(row.amount) };

  const res = await fetch(`${await paymentBaseUrl()}/verify-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "RT-UDDOKTAPAY-API-KEY": apiKey },
    body: JSON.stringify({ invoice_id: invoiceId }),
  });
  const text = await res.text();
  let v: Record<string, any> | null = null;
  try { v = JSON.parse(text); } catch { v = null; }
  if (!res.ok || !v || String(v["status"]).toUpperCase() === "ERROR") {
    console.error("uddoktapay verify failed", res.status, text.slice(0, 500));
    return { status: "failed", amount: Number(row?.amount ?? 0), message: (v?.["message"] as string) || "Payment could not be verified." };
  }

  if (!row) {
    let meta = v["metadata"];
    if (typeof meta === "string") { try { meta = JSON.parse(meta); } catch { meta = {}; } }
    const ref = meta?.ref as string | undefined;
    const metaUser = meta?.user_id as string | undefined;
    const uid = onlyUserId ?? metaUser;
    if (ref) {
      const q = supabaseAdmin.from("uddoktapay_payments").select("*").eq("id", ref);
      const { data } = await (uid ? q.eq("user_id", uid) : q).maybeSingle();
      row = data as Row | null;
    }
    if (!row && uid) {
      const { data } = await supabaseAdmin
        .from("uddoktapay_payments").select("*")
        .eq("user_id", uid).eq("status", "pending").eq("amount", Number(v["amount"]))
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      row = data as Row | null;
    }
    if (!row) return { status: "failed", amount: Number(v["amount"] ?? 0), message: "Payment record not found. Contact admin." };
    if (row.status === "completed") return { status: "completed", amount: Number(row.amount) };
    const { error } = await supabaseAdmin.from("uddoktapay_payments").update({ invoice_id: invoiceId }).eq("id", row.id);
    if (error) throw new Error(error.message);
    row.invoice_id = invoiceId;
  }

  const gatewayStatus = String(v["status"] ?? "").toUpperCase();
  const paidAmount = Number(v["amount"]);
  if (gatewayStatus === "COMPLETED") {
    if (!(paidAmount >= Number(row.amount))) {
      return { status: "failed", amount: Number(row.amount), message: "Paid amount does not match." };
    }
    await supabaseAdmin.from("uddoktapay_payments").update({
      status: "verified",
      payment_method: v["payment_method"] ?? null,
      sender_number: v["sender_number"] ?? null,
      transaction_id: v["transaction_id"] ?? null,
      raw: v,
    }).eq("id", row.id).eq("status", "pending");
    const { data: result, error } = await supabaseAdmin.rpc("credit_uddoktapay_payment", { p_invoice_id: invoiceId });
    if (error) throw new Error(error.message);
    if (result === "OK") {
      const { data: profile } = await supabaseAdmin.from("profiles").select("name, username, email").eq("id", row.user_id).single();
      await notifyOwner(
        `💰 <b>New Deposit (Auto)</b>\nUser: ${profile?.username || profile?.name || profile?.email || row.user_id}\nAmount: ৳${row.amount}\nMethod: ${v["payment_method"] ?? "-"}\nTRX: ${v["transaction_id"] ?? "-"}\nStatus: Credited`,
      );
    }
    if (result === "OK" || result === "ALREADY") return { status: "completed", amount: Number(row.amount) };
    return { status: "failed", amount: Number(row.amount), message: "Credit failed: " + String(result) };
  }

  const newStatus = gatewayStatus === "PENDING" ? "pending" : gatewayStatus === "CANCELLED" ? "cancelled" : "failed";
  await supabaseAdmin.from("uddoktapay_payments").update({ status: newStatus, raw: v }).eq("id", row.id).eq("status", "pending");
  return { status: newStatus, amount: Number(row.amount), message: newStatus === "pending" ? undefined : `Gateway status: ${gatewayStatus || "unknown"}` };
}
