import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { AdminHeader, db, Field, Loadable, useInvalidateAll, useTable } from "@/components/admin/kit";
import { Confirm, errMsg, formatDate, StatusBadge } from "@/components/site/Confirm";
import { EmptyState } from "@/components/site/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettings } from "@/hooks/useSite";
import { money } from "@/lib/site";

export const Route = createFileRoute("/_authenticated/admin/trx")({ component: AdminTrx });

function AdminTrx() {
  const q = useTable("accepted_trx");
  const { settings } = useSettings();
  const invalidate = useInvalidateAll();
  const [f, setF] = useState({ trx_id: "", method: "bkash", amount: "", notes: "" });
  const [search, setSearch] = useState("");
  const save = async () => {
    const trx = f.trx_id.trim().toUpperCase();
    const amount = Number(f.amount);
    if (!trx || trx.length > 64) { toast.error("Enter a valid TRX ID"); return; }
    if (!(amount > 0)) { toast.error("Enter a valid amount"); return; }
    const { error } = await db.from("accepted_trx").insert({ trx_id: trx, method: f.method, amount, notes: f.notes.trim() || null });
    if (error) { toast.error(error.code === "23505" ? "This TRX ID already exists" : errMsg(error)); return; }
    toast.success("TRX ID added");
    setF({ trx_id: "", method: f.method, amount: "", notes: "" });
    invalidate();
  };
  const s = search.trim().toUpperCase();
  const list = (q.data ?? []).filter((t) => !s || t.trx_id.includes(s));
  return (
    <div className="space-y-4">
      <AdminHeader title="Accepted TRX IDs" description="Users can verify a deposit only if TRX ID, method and amount match. Each TRX works once." />
      <div className="panel grid gap-3 p-4 sm:grid-cols-2">
        <Field label="TRX ID"><Input className="h-12 text-base uppercase" value={f.trx_id} onChange={(e) => setF({ ...f, trx_id: e.target.value })} /></Field>
        <Field label="Amount"><Input className="h-12 text-base" type="number" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Payment method">
          <div className="grid grid-cols-2 gap-2">
            {["bkash", "nagad"].map((m) => <Button key={m} type="button" className="h-12" variant={f.method === m ? "default" : "secondary"} onClick={() => setF({ ...f, method: m })}>{m === "bkash" ? "bKash" : "Nagad"}</Button>)}
          </div>
        </Field>
        <Field label="Notes (optional)"><Input className="h-12 text-base" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        <Button className="h-12 text-base sm:col-span-2" onClick={save}>Add TRX ID</Button>
      </div>
      <Input placeholder="Search TRX ID…" className="h-12 text-base" value={search} onChange={(e) => setSearch(e.target.value)} />
      <Loadable q={q}>
        {list.length === 0 ? <EmptyState title="No TRX IDs yet" /> : (
          <div className="space-y-2">
            {list.map((t) => (
              <div key={t.id} className="panel flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2"><code className="break-all font-semibold">{t.trx_id}</code><StatusBadge status={t.status} /></div>
                  <p className="text-xs text-muted-foreground">{t.method === "bkash" ? "bKash" : "Nagad"} · {money(t.amount, settings.currency_symbol)} · {formatDate(t.created_at)}</p>
                  {t.notes && <p className="text-xs text-muted-foreground">{t.notes}</p>}
                  {t.used_at && <p className="text-xs text-muted-foreground">Used {formatDate(t.used_at)}</p>}
                </div>
                {t.status !== "used" && (
                  <Confirm title="Delete this TRX ID?" confirmText="Delete" onConfirm={async () => { const { error } = await db.from("accepted_trx").delete().eq("id", t.id); if (error) { toast.error(errMsg(error)); return; } toast.success("Deleted"); invalidate(); }} trigger={<Button size="icon" variant="ghost" aria-label="Delete" className="h-10 w-10 text-destructive"><Trash2 className="h-4 w-4" /></Button>} />
                )}
              </div>
            ))}
          </div>
        )}
      </Loadable>
    </div>
  );
}
