// Server-only helpers for UddoktaPay (Paymently) auto deposits.
export const UDDOKTAPAY_BASE_URL = "https://khandakerishak.paymently.io/api";
const OWNER_CHAT_ID = "7262501275";

export async function notifyOwner(text: string) {
  try {
    const lovKey = process.env["LOVABLE_API_KEY"];
    const tgKey = process.env["TELEGRAM_API_KEY"];
    if (!lovKey || !tgKey) return;
    const res = await fetch("https://connector-gateway.lovable.dev/telegram/sendMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovKey}`,
        "X-Connection-Api-Key": tgKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ chat_id: OWNER_CHAT_ID, text, parse_mode: "HTML" }),
    });
    if (!res.ok) console.error("telegram notify failed", res.status, await res.text());
  } catch (e) {
    console.error("telegram notify failed", e);
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
  const apiKey = process.env["UDDOKTAPAY_API_KEY"];
  if (!apiKey) throw new Error("UddoktaPay is not configured yet");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const byInvoice = await supabaseAdmin.from("uddoktapay_payments").select("*").eq("invoice_id", invoiceId).maybeSingle();
  let row = byInvoice.data as Row | null;
  if (row && onlyUserId && row.user_id !== onlyUserId) throw new Error("Forbidden");
  if (row?.status === "completed") return { status: "completed", amount: Number(row.amount) };

  const res = await fetch(`${UDDOKTAPAY_BASE_URL}/verify-payment`, {
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
