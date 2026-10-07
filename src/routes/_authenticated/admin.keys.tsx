import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Save, Trash2 } from "lucide-react";
import { AdminHeader, db, Loadable, useInvalidateAll, useTable } from "@/components/admin/kit";
import { Confirm, errMsg, formatDate } from "@/components/site/Confirm";
import { EmptyState } from "@/components/site/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/admin/keys")({
  validateSearch: (s: Record<string, unknown>): { product?: string | undefined; pkg?: string | undefined } => ({
    product: typeof s["product"] === "string" ? (s["product"] as string) : undefined,
    pkg: typeof s["pkg"] === "string" ? (s["pkg"] as string) : undefined,
  }),
  component: AdminKeys,
});

type Pkg = { id: string; name: string; duration: string; price: number; is_active: boolean; sort_order: number };
type Key = { id: string; key_value: string; is_used: boolean; used_at: string | null; order_id: string | null; package_id: string | null };

function AdminKeys() {
  const { product, pkg } = Route.useSearch();
  const navigate = Route.useNavigate();
  const products = useTable("products", "sort_order", true);
  const invalidate = useInvalidateAll();
  const pid = product ?? "";

  const pkgs = useQuery({
    queryKey: ["admin", "packages", pid],
    enabled: !!pid,
    queryFn: async () => {
      const { data, error } = await db.from("product_packages").select("*").eq("product_id", pid).order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Pkg[];
    },
  });
  const keys = useQuery({
    queryKey: ["admin", "keys", pid],
    enabled: !!pid,
    queryFn: async () => {
      const { data, error } = await db.from("product_keys").select("*").eq("product_id", pid).order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Key[];
    },
  });

  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const addPkg = async () => {
    const name = newName.trim();
    const price = Number(newPrice);
    if (!name) { toast.error("প্যাকেজের নাম দিন (যেমন: 2 Days)"); return; }
    if (!(price >= 0)) { toast.error("সঠিক প্রাইস দিন"); return; }
    const sort = (pkgs.data?.length ?? 0) + 1;
    const { error } = await db.from("product_packages").insert({ product_id: pid, name, duration: name, price, sort_order: sort });
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("প্যাকেজ যোগ হয়েছে");
    setNewName(""); setNewPrice("");
    invalidate();
  };

  const allKeys = keys.data ?? [];
  const sel = pkg ?? "";

  return (
    <div className="space-y-4">
      <AdminHeader title="Packages & Keys" description="প্রতিটি প্রোডাক্টের প্যাকেজ (1/3/7/30 দিন বা নিজের মতো), প্রাইস ও Key এখানে সেট করুন।" />
      <Loadable q={products}>
        <select
          aria-label="Product"
          className="h-12 w-full rounded-lg border border-input bg-background px-3 text-base"
          value={pid}
          onChange={(e) => navigate({ search: { product: e.target.value || undefined } })}
        >
          <option value="">প্রোডাক্ট সিলেক্ট করুন…</option>
          {(products.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Loadable>
      {!pid ? <EmptyState title="একটি প্রোডাক্ট সিলেক্ট করুন" /> : (
        <Loadable q={pkgs}>
          <div className="space-y-2">
            <p className="font-semibold">প্যাকেজ সমূহ</p>
            {(pkgs.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">কোনো প্যাকেজ নেই — নিচে যোগ করুন।</p>}
            {(pkgs.data ?? []).map((p) => (
              <PkgRow
                key={p.id}
                p={p}
                keys={allKeys.filter((k) => k.package_id === p.id)}
                selected={sel === p.id}
                onSelect={() => navigate({ search: { product: pid, pkg: sel === p.id ? undefined : p.id } })}
                onChanged={invalidate}
              />
            ))}
            <div className="panel space-y-2 p-3">
              <p className="text-sm font-semibold">নতুন প্যাকেজ যোগ করুন</p>
              <div className="flex gap-2">
                <Input className="h-11 flex-1 text-base" placeholder="যেমন: 2 Days" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <Input className="h-11 w-24 text-base" type="number" min={0} inputMode="decimal" placeholder="৳" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
              </div>
              <Button className="h-11 w-full" onClick={addPkg}><Plus className="mr-1 h-4 w-4" /> প্যাকেজ যোগ করুন</Button>
            </div>
          </div>
          {sel && <KeyManager pid={pid} pkgId={sel} pkgName={pkgs.data?.find((p) => p.id === sel)?.name ?? ""} keys={allKeys.filter((k) => k.package_id === sel)} onChanged={invalidate} />}
        </Loadable>
      )}
    </div>
  );
}

function PkgRow({ p, keys, selected, onSelect, onChanged }: { p: Pkg; keys: Key[]; selected: boolean; onSelect: () => void; onChanged: () => void }) {
  const [name, setName] = useState(p.name);
  const [price, setPrice] = useState(String(p.price));
  useEffect(() => { setName(p.name); setPrice(String(p.price)); }, [p.name, p.price]);
  const avail = keys.filter((k) => !k.is_used).length;
  const dirty = name !== p.name || Number(price) !== Number(p.price);

  const save = async (patch: Partial<Pkg>) => {
    const { error } = await db.from("product_packages").update(patch).eq("id", p.id);
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("সেভ হয়েছে");
    onChanged();
  };
  const del = async () => {
    if (keys.some((k) => k.is_used)) {
      await save({ is_active: false });
      return;
    }
    await db.from("product_keys").delete().eq("package_id", p.id);
    const { error } = await db.from("product_packages").delete().eq("id", p.id);
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("প্যাকেজ ডিলিট হয়েছে");
    onChanged();
  };

  return (
    <div className={`panel space-y-2 p-3 ${selected ? "ring-2 ring-primary" : ""}`}>
      <div className="flex items-center gap-2">
        <Input className="h-11 flex-1 text-base" value={name} onChange={(e) => setName(e.target.value)} aria-label="Package name" />
        <Input className="h-11 w-24 text-base" type="number" min={0} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} aria-label="Price" />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Key: {avail} available / {keys.length} total</span>
        <label className="ml-auto flex items-center gap-1">Active <Switch checked={p.is_active} onCheckedChange={(v) => void save({ is_active: v })} /></label>
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="flex-1" disabled={!dirty} onClick={() => {
          const n = Number(price);
          if (!name.trim() || !(n >= 0)) { toast.error("নাম ও প্রাইস ঠিক করুন"); return; }
          void save({ name: name.trim(), duration: name.trim(), price: n });
        }}><Save className="mr-1 h-4 w-4" /> সেভ</Button>
        <Button size="sm" variant={selected ? "default" : "secondary"} className="flex-1" onClick={onSelect}>{selected ? "বন্ধ করুন" : "Key যোগ/দেখুন"}</Button>
        <Confirm title="প্যাকেজ ডিলিট করবেন?" description="বিক্রি হওয়া Key থাকলে শুধু হাইড হবে।" confirmText="Delete" onConfirm={() => void del()} trigger={<Button size="icon" variant="ghost" aria-label="Delete package" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>} />
      </div>
    </div>
  );
}

function KeyManager({ pid, pkgId, pkgName, keys, onChanged }: { pid: string; pkgId: string; pkgName: string; keys: Key[]; onChanged: () => void }) {
  const [bulk, setBulk] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "available" | "used">("available");
  const available = keys.filter((k) => !k.is_used).length;
  const shown = keys.filter((k) => filter === "all" || (filter === "used" ? k.is_used : !k.is_used));

  const syncStock = async () => {
    const { count } = await db.from("product_keys").select("id", { count: "exact", head: true }).eq("product_id", pid).eq("is_used", false);
    await db.from("products").update({ stock: count ?? 0 }).eq("id", pid);
  };

  const add = async () => {
    const lines = Array.from(new Set(bulk.split(/\r?\n/).map((l) => l.trim()).filter(Boolean))).filter((l) => l.length <= 500);
    if (!lines.length) { toast.error("অন্তত একটি Key দিন"); return; }
    setSaving(true);
    const { data, error } = await db.from("product_keys").upsert(lines.map((key_value) => ({ product_id: pid, package_id: pkgId, key_value })), { onConflict: "product_id,key_value", ignoreDuplicates: true }).select("id");
    if (error) { setSaving(false); toast.error(errMsg(error)); return; }
    await syncStock();
    setSaving(false);
    const added = data?.length ?? 0;
    toast.success(`${added} টি Key যোগ হয়েছে${lines.length - added ? `, ${lines.length - added} টি ডুপ্লিকেট বাদ` : ""}`);
    setBulk("");
    onChanged();
  };

  const del = async (id: string) => {
    const { error } = await db.from("product_keys").delete().eq("id", id);
    if (error) { toast.error(errMsg(error)); return; }
    await syncStock();
    toast.success("Key ডিলিট হয়েছে");
    onChanged();
  };

  return (
    <div className="space-y-3">
      <p className="font-semibold">{pkgName} — Keys</p>
      <div className="grid grid-cols-3 gap-2">
        {[["Total", keys.length], ["Available", available], ["Sold", keys.length - available]].map(([l, v]) => (
          <div key={l} className="panel p-3 text-center"><p className="text-xs text-muted-foreground">{l}</p><p className="font-display text-2xl font-bold">{v}</p></div>
        ))}
      </div>
      <div className="panel space-y-3 p-4">
        <Textarea rows={8} className="font-mono text-base" placeholder={"KEY-001\nKEY-002\nKEY-003"} value={bulk} onChange={(e) => setBulk(e.target.value)} />
        <p className="text-xs text-muted-foreground">প্রতি লাইনে একটি Key। {bulk.split(/\r?\n/).filter((l) => l.trim()).length} লাইন।</p>
        <Button className="h-12 w-full text-base" onClick={add} disabled={saving}>{saving ? "যোগ হচ্ছে…" : "Key যোগ করুন"}</Button>
      </div>
      <div className="flex gap-2">
        {(["available", "used", "all"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "secondary"} className="flex-1 rounded-full capitalize" onClick={() => setFilter(f)}>{f === "used" ? "Sold" : f}</Button>
        ))}
      </div>
      {shown.length === 0 ? <EmptyState title="কোনো Key নেই" /> : (
        <div className="space-y-2">
          {shown.map((k) => (
            <div key={k.id} className="panel flex items-center gap-2 p-3">
              <div className="min-w-0 flex-1">
                <code className="block break-all text-sm">{k.key_value}</code>
                <p className="text-xs text-muted-foreground">{k.is_used ? `Sold ${formatDate(k.used_at)} · Order #${k.order_id?.slice(0, 8) ?? "—"}` : "Available"}</p>
              </div>
              {!k.is_used && (
                <Confirm title="Key ডিলিট করবেন?" confirmText="Delete" onConfirm={() => void del(k.id)} trigger={<Button size="icon" variant="ghost" aria-label="Delete key" className="h-10 w-10 text-destructive"><Trash2 className="h-4 w-4" /></Button>} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
