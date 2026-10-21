import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Gift, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader } from "@/components/admin/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { money } from "@/lib/site";

export const Route = createFileRoute("/_authenticated/admin/redeem-codes")({ component: RedeemCodesPage });

type RedeemCode = { id: string; code: string; amount: number; max_uses: number; used_count: number; is_active: boolean; expires_at: string | null; created_at: string };

function RedeemCodesPage() {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("10");
  const [uses, setUses] = useState("1");
  const [busy, setBusy] = useState(false);
  const [createdCode, setCreatedCode] = useState("");
  const codes = useQuery({
    queryKey: ["admin", "redeem-codes"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_list_redeem_codes");
      if (error) throw error;
      return (data ?? []) as RedeemCode[];
    },
  });
  const create = async () => {
    const value = Number(amount);
    const maxUses = Number(uses);
    if (!Number.isFinite(value) || value < 1 || value > 100000) { toast.error("৳১ থেকে ৳১,০০,০০০ পর্যন্ত সঠিক Amount দিন"); return; }
    if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 10000) { toast.error("সঠিক ব্যবহার সংখ্যা দিন"); return; }
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc("create_redeem_code", { p_amount: value, p_max_uses: maxUses, p_expires_at: null });
      if (error) throw error;
      const code = String(data?.code ?? "");
      if (!code) throw new Error("কোড তৈরি হয়নি");
      setCreatedCode(code);
      toast.success("Redeem code তৈরি হয়েছে");
      await queryClient.invalidateQueries({ queryKey: ["admin", "redeem-codes"] });
    } catch (e) {
      const message = String((e as { message?: string })?.message ?? e);
      toast.error(message.includes("Admin only") ? "শুধু Admin কোড তৈরি করতে পারবেন" : "Redeem code তৈরি করা যায়নি");
    } finally { setBusy(false); }
  };
  const copy = async (code: string) => {
    try { await navigator.clipboard.writeText(code); toast.success("Code কপি হয়েছে"); }
    catch { toast.error("কপি করা যায়নি; কোডটি সিলেক্ট করে কপি করুন"); }
  };
  return (
    <div className="space-y-4">
      <AdminHeader title="Redeem Codes" description="Website এবং Telegram—দুই জায়গাতেই একই code ব্যবহার করা যাবে, কিন্তু প্রতিটি use একবারই গণনা হবে।" />
      <div className="panel space-y-3 p-4">
        <h2 className="flex items-center gap-2 font-semibold"><Gift className="h-5 w-5 text-primary" /> নতুন Redeem Code তৈরি করুন</h2>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-sm">কত টাকা যোগ হবে?
            <Input type="number" min="1" max="100000" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="space-y-1 text-sm">সর্বোচ্চ ব্যবহার
            <Input type="number" min="1" max="10000" value={uses} onChange={(e) => setUses(e.target.value)} />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">একবার ব্যবহারযোগ্য কোডের জন্য সর্বোচ্চ ব্যবহার ১ রাখুন।</p>
        <Button className="w-full" onClick={() => void create()} disabled={busy}><Plus className="mr-1 h-4 w-4" />{busy ? "তৈরি হচ্ছে…" : "Create Redeem Code"}</Button>
        {createdCode && <div className="space-y-2 rounded-lg border border-primary/30 p-3">
          <p className="text-sm font-medium">নতুন কোড — {money(Number(amount), "৳")}</p>
          <code className="block break-all text-lg font-bold">{createdCode}</code>
          <Button variant="secondary" className="w-full" onClick={() => void copy(createdCode)}><Copy className="mr-1 h-4 w-4" /> কোড কপি করুন</Button>
        </div>}
      </div>
      <div className="space-y-2">
        <h2 className="font-semibold">সাম্প্রতিক কোড</h2>
        {codes.isLoading ? <div className="panel p-4 text-sm">লোড হচ্ছে…</div> : codes.error ? <div className="panel p-4 text-sm text-destructive">কোডের তালিকা লোড করা যায়নি। Admin permission যাচাই করুন।</div> : (codes.data ?? []).length === 0 ? <div className="panel p-4 text-sm text-muted-foreground">এখনো কোনো কোড তৈরি করা হয়নি।</div> : (codes.data ?? []).map((c) => (
          <div key={c.id} className="panel space-y-2 p-3">
            <div className="flex items-start justify-between gap-2">
              <code className="break-all font-semibold">{c.code}</code>
              <Button size="icon" variant="ghost" aria-label="Copy code" onClick={() => void copy(c.code)}><Copy className="h-4 w-4" /></Button>
            </div>
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <span>{money(c.amount, "৳")} credit</span>
              <span>{c.used_count}/{c.max_uses} used</span>
              <span className={c.is_active ? "text-emerald-600" : "text-muted-foreground"}>{c.is_active ? "Active" : "Used / Inactive"}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
