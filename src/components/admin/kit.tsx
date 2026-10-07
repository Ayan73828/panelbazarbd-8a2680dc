import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { errMsg } from "@/components/site/Confirm";
import { ErrorState, RowSkeleton } from "@/components/site/States";
import { DEFAULT_SETTINGS } from "@/lib/site";

// Untyped handle for generic admin CRUD; RLS still enforces admin-only writes server-side.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = supabase as any;

export function AdminHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string | undefined }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function SwitchField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
      {label}
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

export function useTable(table: string, order = "created_at", ascending = false) {
  return useQuery({
    queryKey: ["admin", table],
    queryFn: async () => {
      const { data, error } = await db.from(table).select("*").order(order, { ascending });
      if (error) throw error;
      return (data ?? []) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    },
  });
}

export function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

export function Loadable({ q, children }: { q: { isLoading: boolean; error: unknown; refetch: () => void }; children: ReactNode }) {
  if (q.isLoading) return <RowSkeleton />;
  if (q.error) return <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} />;
  return <>{children}</>;
}

type SettingDef = { key: keyof typeof DEFAULT_SETTINGS; label: string; type?: "text" | "textarea" | "color" | "select"; options?: string[]; hint?: string };

/** Edits a group of rows in site_settings (key/value). */
export function SettingsForm({ fields }: { fields: SettingDef[] }) {
  const invalidate = useInvalidateAll();
  const q = useQuery({
    queryKey: ["site_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_settings").select("key,value");
      if (error) throw error;
      const map: Record<string, string> = { ...DEFAULT_SETTINGS };
      for (const r of data ?? []) map[r.key] = r.value ?? "";
      return map;
    },
  });
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const values = draft ?? q.data ?? {};
  const save = useMutation({
    mutationFn: async () => {
      const rows = fields.map((f) => ({ key: f.key, value: (values[f.key] ?? "").trim() }));
      const { error } = await supabase.from("site_settings").upsert(rows, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved — the website is updated");
      setDraft(null);
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const set = (k: string, v: string) => setDraft({ ...values, [k]: v });
  return (
    <Loadable q={q}>
      <form
        className="panel grid gap-4 p-4 sm:grid-cols-2 sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        {fields.map((f) => (
          <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
            <Field label={f.label} hint={f.hint}>
              {f.type === "textarea" ? (
                <Textarea rows={3} maxLength={2000} value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />
              ) : f.type === "color" ? (
                <div className="flex gap-2">
                  <input type="color" className="h-10 w-12 rounded border border-border bg-transparent" value={values[f.key] || "#22c55e"} onChange={(e) => set(f.key, e.target.value)} />
                  <Input value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />
                </div>
              ) : f.type === "select" ? (
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)}>
                  {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <Input maxLength={500} value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />
              )}
            </Field>
          </div>
        ))}
        <div className="sm:col-span-2">
          <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save changes"}</Button>
        </div>
      </form>
    </Loadable>
  );
}
