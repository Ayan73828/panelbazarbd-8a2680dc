import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import { AdminHeader, db, Field, Loadable, SwitchField, useInvalidateAll, useTable } from "@/components/admin/kit";
import { Confirm, errMsg } from "@/components/site/Confirm";
import { EmptyState } from "@/components/site/States";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSettings } from "@/hooks/useSite";
import { money, PRODUCT_STATUSES, slugify, statusLabel } from "@/lib/site";

export const Route = createFileRoute("/_authenticated/admin/products")({ component: AdminProducts });

type P = any; // eslint-disable-line @typescript-eslint/no-explicit-any

const blank: P = {
  name: "", slug: "", category_id: "", short_description: "", full_description: "", features: "",
  image_url: "", images: "", price: 0, discount_price: "", stock: 0, status: "in_stock",
  demo_url: "", purchase_url: "", is_featured: false, is_best_seller: false, is_active: true, sort_order: 0,
};

function AdminProducts() {
  const q = useTable("products", "sort_order", true);
  const cats = useTable("categories", "sort_order", true);
  const { settings } = useSettings();
  const invalidate = useInvalidateAll();
  const [edit, setEdit] = useState<P | null>(null);
  const [search, setSearch] = useState("");
  const catName = (id: string) => cats.data?.find((c) => c.id === id)?.name ?? "—";
  const list = (q.data ?? []).filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  const run = async (fn: () => Promise<{ error: unknown }>, ok: string) => {
    const { error } = await fn();
    if (error) { toast.error(errMsg(error)); return; }
    toast.success(ok);
    invalidate();
  };

  const duplicate = (p: P) => {
    const { id: _id, created_at: _c, updated_at: _u, ...rest } = p;
    const suffix = Math.random().toString(36).slice(2, 6);
    run(() => db.from("products").insert({ ...rest, name: `${p.name} (copy)`, slug: `${p.slug}-${suffix}`, is_active: false }), "Product duplicated (hidden until you enable it)");
  };

  return (
    <div>
      <AdminHeader title="Products" description="Add, edit and organise everything you sell." action={<Button onClick={() => setEdit({ ...blank })}><Plus className="mr-1 h-4 w-4" /> Add product</Button>} />
      <Input placeholder="Search products…" className="mb-4 max-w-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
      <Loadable q={q}>
        {list.length === 0 ? <EmptyState title="No products" description="Add your first product to start selling." /> : (
          <div className="grid gap-2">
            {list.map((p) => (
              <div key={p.id} className="panel flex flex-wrap items-center gap-3 p-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                  {p.image_url && <img src={p.image_url} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name} {!p.is_active && <span className="text-xs text-muted-foreground">(hidden)</span>}</p>
                  <p className="text-xs text-muted-foreground">
                    {catName(p.category_id)} · {money(p.discount_price || p.price, settings.currency_symbol)} · Stock {p.stock} · {statusLabel(p.status)}
                    {p.is_featured && " · Featured"}{p.is_best_seller && " · Best seller"}
                  </p>
                </div>
                <div className="flex w-full flex-wrap gap-1 sm:w-auto">
                  <Button asChild size="sm"><Link to="/admin/keys" search={{ product: p.id }}><KeyRound className="mr-1 h-4 w-4" /> Packages & Keys</Link></Button>
                  <Button size="sm" variant="secondary" onClick={() => run(() => db.from("products").update({ is_active: !p.is_active }).eq("id", p.id), p.is_active ? "Product hidden" : "Product enabled")}>{p.is_active ? "Disable" : "Enable"}</Button>
                  <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEdit({ ...p, features: (p.features ?? []).join("\n"), images: (p.images ?? []).join("\n"), discount_price: p.discount_price ?? "", category_id: p.category_id ?? "" })}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label="Duplicate" onClick={() => duplicate(p)}><Copy className="h-4 w-4" /></Button>
                  <Confirm title="Delete this product?" description="This cannot be undone. Past orders are kept." confirmText="Delete" onConfirm={() => void run(() => db.from("products").delete().eq("id", p.id), "Product deleted")} trigger={<Button size="icon" variant="ghost" aria-label="Delete" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Loadable>
      {edit && <ProductDialog value={edit} cats={cats.data ?? []} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); invalidate(); }} />}
    </div>
  );
}

function ProductDialog({ value, cats, onClose, onSaved }: { value: P; cats: P[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<P>(value);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const set = (k: string, v: unknown) => setF((s: P) => ({ ...s, [k]: v }));
  const uploadProductImage = async (file: File, target: "main" | "gallery" = "main") => {
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("Each image must be smaller than 8 MB"); return; }
    setUploadingImage(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `products/${crypto.randomUUID()}.${ext}`;
      const { data, error } = await db.storage.from("product-images").upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (error) throw error;
      const { data: publicUrl } = db.storage.from("product-images").getPublicUrl(data.path);
      if (target === "main") {
        set("image_url", publicUrl.publicUrl);
      } else {
        set("images", [...String(f.images || "").split("\n").map((s) => s.trim()).filter(Boolean), publicUrl.publicUrl].join("\n"));
      }
      toast.success("Image uploaded");
    } catch (e) {
      toast.error(`Image upload failed: ${errMsg(e)}`);
    } finally {
      setUploadingImage(false);
    }
  };
  const uploadProductImages = async (files: FileList | null, target: "main" | "gallery") => {
    if (!files?.length) return;
    for (const file of Array.from(files)) await uploadProductImage(file, target);
  };
  const save = async () => {
    if (!f.name.trim()) { toast.error("Name is required"); return; }
    const price = Number(f.price);
    if (!(price >= 0)) { toast.error("Enter a valid price"); return; }
    const row = {
      name: f.name.trim().slice(0, 200),
      slug: slugify(f.slug || f.name) || `product-${Date.now()}`,
      category_id: f.category_id || null,
      short_description: f.short_description || null,
      full_description: f.full_description || null,
      features: String(f.features || "").split("\n").map((s) => s.trim()).filter(Boolean),
      image_url: f.image_url || null,
      images: String(f.images || "").split("\n").map((s) => s.trim()).filter(Boolean),
      price,
      discount_price: f.discount_price === "" || f.discount_price == null ? null : Number(f.discount_price),
      stock: Math.max(0, Math.floor(Number(f.stock) || 0)),
      status: f.status,
      demo_url: f.demo_url || null,
      purchase_url: f.purchase_url || null,
      is_featured: !!f.is_featured,
      is_best_seller: !!f.is_best_seller,
      is_active: !!f.is_active,
      sort_order: Math.floor(Number(f.sort_order) || 0),
    };
    setSaving(true);
    const { error } = f.id ? await db.from("products").update(row).eq("id", f.id) : await db.from("products").insert(row);
    setSaving(false);
    if (error) { toast.error(error.code === "23505" ? "That URL slug is already used" : errMsg(error)); return; }
    toast.success(f.id ? "Product updated" : "Product created");
    onSaved();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{f.id ? "Edit product" : "Add product"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name"><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="URL slug" hint="Leave empty to generate from name"><Input value={f.slug} onChange={(e) => set("slug", e.target.value)} /></Field>
          <Field label="Category">
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.category_id} onChange={(e) => set("category_id", e.target.value)}>
              <option value="">No category</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.status} onChange={(e) => set("status", e.target.value)}>
              {PRODUCT_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>
          </Field>
          <Field label="Regular price"><Input type="number" min={0} step="0.01" value={f.price} onChange={(e) => set("price", e.target.value)} /></Field>
          <Field label="Discount price" hint="Optional"><Input type="number" min={0} step="0.01" value={f.discount_price} onChange={(e) => set("discount_price", e.target.value)} /></Field>
          <Field label="Stock"><Input type="number" min={0} value={f.stock} onChange={(e) => set("stock", e.target.value)} /></Field>
          <Field label="Sort position" hint="Lower shows first"><Input type="number" value={f.sort_order} onChange={(e) => set("sort_order", e.target.value)} /></Field>
          <div className="sm:col-span-2 space-y-2">
            <Field label="Main product photo" hint="Tap to choose a photo from your phone gallery. Maximum 8 MB.">
              <Input type="file" accept="image/*" disabled={uploadingImage} onChange={(e) => { void uploadProductImages(e.target.files, "main"); e.currentTarget.value = ""; }} />
            </Field>
            {uploadingImage && <p className="text-sm text-muted-foreground">Uploading image…</p>}
            {f.image_url && <div className="flex items-center gap-3 rounded-lg border p-2"><img src={f.image_url} alt="Product preview" className="h-20 w-20 rounded-md object-cover" /><div className="min-w-0 flex-1"><p className="text-sm font-medium">Selected main photo</p><Button type="button" variant="ghost" size="sm" onClick={() => set("image_url", "")}>Remove photo</Button></div></div>}
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Field label="Additional product photos" hint="Choose one or multiple photos from your phone gallery. Each image must be under 8 MB.">
              <Input type="file" accept="image/*" multiple disabled={uploadingImage} onChange={(e) => { void uploadProductImages(e.target.files, "gallery"); e.currentTarget.value = ""; }} />
            </Field>
            {String(f.images || "").split("\n").filter(Boolean).length > 0 && <div className="grid grid-cols-3 gap-2">{String(f.images || "").split("\n").map((url, index) => url.trim() ? <div key={url + index} className="relative overflow-hidden rounded-lg border"><img src={url.trim()} alt={`Product photo ${index + 1}`} className="h-24 w-full object-cover" /><Button type="button" variant="secondary" size="sm" className="w-full rounded-none" onClick={() => set("images", String(f.images || "").split("\n").filter(Boolean).filter((_, i) => i !== index).join("\n"))}>Remove</Button></div> : null)}</div>}
          </div>
          <div className="sm:col-span-2"><Field label="Short description"><Input maxLength={300} value={f.short_description ?? ""} onChange={(e) => set("short_description", e.target.value)} /></Field></div>
          <div className="sm:col-span-2"><Field label="Full description"><Textarea rows={4} value={f.full_description ?? ""} onChange={(e) => set("full_description", e.target.value)} /></Field></div>
          <div className="sm:col-span-2"><Field label="Features" hint="One per line"><Textarea rows={3} value={f.features} onChange={(e) => set("features", e.target.value)} /></Field></div>
          <Field label="Demo URL"><Input value={f.demo_url ?? ""} onChange={(e) => set("demo_url", e.target.value)} /></Field>
          <Field label="Purchase / access URL" hint="Shown to buyers after order completes"><Input value={f.purchase_url ?? ""} onChange={(e) => set("purchase_url", e.target.value)} /></Field>
          <SwitchField label="Visible on site" checked={!!f.is_active} onChange={(v) => set("is_active", v)} />
          <SwitchField label="Featured" checked={!!f.is_featured} onChange={(v) => set("is_featured", v)} />
          <SwitchField label="Best seller" checked={!!f.is_best_seller} onChange={(v) => set("is_best_seller", v)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save product"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
