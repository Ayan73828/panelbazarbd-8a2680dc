import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { AdminHeader, db, Field, Loadable, SwitchField, useInvalidateAll, useTable } from "@/components/admin/kit";
import { Confirm, errMsg } from "@/components/site/Confirm";
import { EmptyState } from "@/components/site/States";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { slugify } from "@/lib/site";

export const Route = createFileRoute("/_authenticated/admin/categories")({ component: AdminCategories });

type C = any; // eslint-disable-line @typescript-eslint/no-explicit-any

function AdminCategories() {
  const q = useTable("categories", "sort_order", true);
  const invalidate = useInvalidateAll();
  const [edit, setEdit] = useState<C | null>(null);
  const run = async (p: Promise<{ error: unknown }>, ok: string) => {
    const { error } = await p;
    if (error) { toast.error(errMsg(error)); return; }
    toast.success(ok);
    invalidate();
  };
  const save = async () => {
    if (!edit?.name?.trim()) { toast.error("Name is required"); return; }
    const row = { name: edit.name.trim(), slug: slugify(edit.slug || edit.name), image_url: edit.image_url || null, sort_order: Number(edit.sort_order) || 0, is_active: !!edit.is_active };
    await run(edit.id ? db.from("categories").update(row).eq("id", edit.id) : db.from("categories").insert(row), "Category saved");
    setEdit(null);
  };
  return (
    <div>
      <AdminHeader title="Categories" action={<Button onClick={() => setEdit({ name: "", slug: "", image_url: "", sort_order: 0, is_active: true })}><Plus className="mr-1 h-4 w-4" /> Add category</Button>} />
      <Loadable q={q}>
        {!q.data?.length ? <EmptyState title="No categories yet" /> : (
          <div className="grid gap-2">
            {q.data.map((c) => (
              <div key={c.id} className="panel flex items-center gap-3 p-3">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-surface-2">{c.image_url && <img src={c.image_url} alt="" className="h-full w-full object-cover" />}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.name} {!c.is_active && <span className="text-xs text-muted-foreground">(hidden)</span>}</p>
                  <p className="text-xs text-muted-foreground">/{c.slug} · position {c.sort_order}</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => run(db.from("categories").update({ is_active: !c.is_active }).eq("id", c.id), "Updated")}>{c.is_active ? "Disable" : "Enable"}</Button>
                <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEdit({ ...c })}><Pencil className="h-4 w-4" /></Button>
                <Confirm title="Delete category?" description="Products in it will become uncategorised." confirmText="Delete" onConfirm={() => void run(db.from("categories").delete().eq("id", c.id), "Category deleted")} trigger={<Button size="icon" variant="ghost" aria-label="Delete" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>} />
              </div>
            ))}
          </div>
        )}
      </Loadable>
      {edit && (
        <Dialog open onOpenChange={(o) => !o && setEdit(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{edit.id ? "Edit category" : "Add category"}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <Field label="Name"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <Field label="URL slug" hint="Leave empty to generate"><Input value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} /></Field>
              <Field label="Image / icon URL"><Input value={edit.image_url ?? ""} onChange={(e) => setEdit({ ...edit, image_url: e.target.value })} /></Field>
              <Field label="Position"><Input type="number" value={edit.sort_order} onChange={(e) => setEdit({ ...edit, sort_order: e.target.value })} /></Field>
              <SwitchField label="Visible" checked={!!edit.is_active} onChange={(v) => setEdit({ ...edit, is_active: v })} />
              <Button onClick={save}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
