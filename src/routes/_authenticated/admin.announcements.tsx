import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AdminHeader, db, Field, Loadable, SwitchField, useInvalidateAll, useTable } from "@/components/admin/kit";
import { Confirm, errMsg, formatDate } from "@/components/site/Confirm";
import { EmptyState } from "@/components/site/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/admin/announcements")({ component: AdminAnnouncements });

const empty = { id: "", title: "", message: "", type: "banner", start_date: "", end_date: "", is_active: true };
const toLocal = (v: string | null) => (v ? new Date(v).toISOString().slice(0, 16) : "");

function AdminAnnouncements() {
  const q = useTable("announcements");
  const invalidate = useInvalidateAll();
  const [f, setF] = useState(empty);
  const save = async () => {
    if (!f.title.trim()) { toast.error("Title is required"); return; }
    const row = {
      title: f.title.trim().slice(0, 200), message: f.message.trim().slice(0, 2000), type: f.type, is_active: f.is_active,
      start_date: f.start_date ? new Date(f.start_date).toISOString() : null,
      end_date: f.end_date ? new Date(f.end_date).toISOString() : null,
    };
    const { error } = f.id ? await db.from("announcements").update(row).eq("id", f.id) : await db.from("announcements").insert(row);
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("Saved");
    setF(empty);
    invalidate();
  };
  return (
    <div className="space-y-4">
      <AdminHeader title="Announcements" description="Banner on the homepage, popup, or dashboard notice." />
      <div className="panel grid gap-3 p-4 sm:grid-cols-2">
        <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Type">
          <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            <option value="banner">Homepage banner</option><option value="popup">Popup</option><option value="dashboard">Dashboard notice</option>
          </select>
        </Field>
        <div className="sm:col-span-2"><Field label="Message"><Textarea rows={3} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></Field></div>
        <Field label="Start (optional)"><Input type="datetime-local" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></Field>
        <Field label="End (optional)"><Input type="datetime-local" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} /></Field>
        <SwitchField label="Active" checked={f.is_active} onChange={(v) => setF({ ...f, is_active: v })} />
        <div className="flex gap-2">
          <Button onClick={save}>{f.id ? "Update" : "Add announcement"}</Button>
          {f.id && <Button variant="secondary" onClick={() => setF(empty)}>Cancel</Button>}
        </div>
      </div>
      <Loadable q={q}>
        {(q.data ?? []).length === 0 ? <EmptyState title="No announcements yet" /> : (
          <div className="space-y-2">
            {(q.data ?? []).map((a) => (
              <div key={a.id} className="panel flex items-start justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{a.title} <span className="text-xs text-muted-foreground">· {a.type} · {a.is_active ? "active" : "inactive"}</span></p>
                  <p className="text-xs text-muted-foreground">{a.message}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(a.start_date)} → {formatDate(a.end_date)}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="secondary" onClick={() => setF({ ...a, message: a.message ?? "", start_date: toLocal(a.start_date), end_date: toLocal(a.end_date) })}>Edit</Button>
                  <Confirm trigger={<Button size="sm" variant="destructive">Delete</Button>} title="Delete announcement?" confirmText="Delete" onConfirm={async () => {
                    const { error } = await db.from("announcements").delete().eq("id", a.id);
                    if (error) { toast.error(errMsg(error)); return; }
                    toast.success("Deleted"); invalidate();
                  }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Loadable>
    </div>
  );
}
