import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader, db, Field, Loadable, useInvalidateAll, useTable } from "@/components/admin/kit";
import { Confirm, errMsg, formatDate } from "@/components/site/Confirm";
import { EmptyState } from "@/components/site/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettings } from "@/hooks/useSite";
import { money } from "@/lib/site";
import { adminDeleteUser, adminResetPassword, adminSetUserRoles, adminSaveUserPermissions } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/users")({ component: AdminUsers });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type U = any;

function AdminUsers() {
  const q = useTable("profiles");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<U | null>(null);
  const s = search.trim().toLowerCase();
  const list = (q.data ?? []).filter((u) => !s || [u.name, u.username, u.email, u.phone].some((x) => (x ?? "").toLowerCase().includes(s)));
  return (
    <div className="space-y-4">
      <AdminHeader title="Users" description="Search, edit, manage balance and access." />
      <Input className="h-11" placeholder="Search name, username, email, phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
      <Loadable q={q}>
        {list.length === 0 ? <EmptyState title="No users found" /> : (
          <div className="space-y-2">
            {list.map((u) => (
              <button key={u.id} onClick={() => setOpen(u)} className="panel flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-surface-2">
                <span className="min-w-0 text-sm">
                  <span className="font-medium">{u.name || "—"}</span> {!u.is_active && <span className="text-xs text-destructive">(disabled)</span>}
                  <span className="block truncate text-xs text-muted-foreground">@{u.username} · {u.email} · {u.phone}</span>
                </span>
                <UserBalance v={u.balance} />
              </button>
            ))}
          </div>
        )}
      </Loadable>
      {open && <UserDetail user={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function UserBalance({ v }: { v: number }) {
  const { settings } = useSettings();
  return <span className="shrink-0 font-semibold text-primary">{money(v, settings.currency_symbol)}</span>;
}

function UserDetail({ user, onClose }: { user: U; onClose: () => void }) {
  const invalidate = useInvalidateAll();
  const { settings } = useSettings();
  const [f, setF] = useState({ name: user.name ?? "", phone: user.phone ?? "", username: user.username ?? "" });
  const [amt, setAmt] = useState("");
  const [desc, setDesc] = useState("");
  const [pw, setPw] = useState("");
  const resetPw = useServerFn(adminResetPassword);
  const delUser = useServerFn(adminDeleteUser);
  const setUserRoles = useServerFn(adminSetUserRoles);
  const saveUserPermissions = useServerFn(adminSaveUserPermissions);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [initialPermissions, setInitialPermissions] = useState<string[]>([]);
  const [permissionsBusy, setPermissionsBusy] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [initialRoles, setInitialRoles] = useState<string[]>([]);
  const [roleBusy, setRoleBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data, error }) => {
      if (!active) return;
      if (error) { toast.error("Could not load user roles: " + error.message); return; }
      const roles = (data ?? []).map((row) => String(row.role).toLowerCase()).filter((role) => ["user", "customer_agent", "admin"].includes(role));
      setSelectedRoles(roles);
      setInitialRoles(roles);
    });
    void supabase.from("admin_subadmins").select("permissions").eq("user_id", user.id).maybeSingle().then(({ data, error }) => {
      if (!active) return;
      if (error) { toast.error("Could not load user permissions: " + error.message); return; }
      const values = (data?.permissions ?? []) as string[];
      setPermissions(values);
      setInitialPermissions(values);
    });
    return () => { active = false; };
  }, [user.id]);
  const savePermissions = async () => {
    setPermissionsBusy(true);
    try {
      await saveUserPermissions({ data: { userId: user.id, permissions } });
      setInitialPermissions(permissions);
      toast.success("User permissions saved");
      invalidate();
    } catch (e) { toast.error(errMsg(e)); }
    finally { setPermissionsBusy(false); }
  };
  const saveRoles = async () => {
    setRoleBusy(true);
    try {
      await setUserRoles({ data: { userId: user.id, roles: selectedRoles } });
      setInitialRoles(selectedRoles);
      toast.success("User roles updated");
      invalidate();
    } catch (e) { toast.error(errMsg(e)); }
    finally { setRoleBusy(false); }
  };
  const [hist, setHist] = useState<{ orders: U[]; txs: U[] } | null>(null);

  const loadHist = async () => {
    const [o, t] = await Promise.all([
      supabase.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("wallet_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    setHist({ orders: o.data ?? [], txs: t.data ?? [] });
  };

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast.success(ok); invalidate(); } catch (e) { toast.error(errMsg(e)); }
  };
  const check = (r: { error: unknown }) => { if (r.error) throw r.error; };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="panel max-h-[92vh] w-full max-w-lg overflow-y-auto p-4 sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{user.name}</h2>
          <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
        </div>
        <p className="text-xs text-muted-foreground">{user.email} · joined {formatDate(user.created_at)}</p>
        <p className="mt-1 text-sm">Balance: <b className="text-primary">{money(user.balance, settings.currency_symbol)}</b></p>

        <div className="mt-4 grid gap-3">
          <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Username"><Input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></Field>
          <Field label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => run(async () => check(await db.from("profiles").update({ name: f.name.trim(), phone: f.phone.trim(), username: f.username.trim() || null }).eq("id", user.id)), "Saved")}>Save details</Button>
            <Button size="sm" variant="secondary" onClick={() => run(async () => check(await db.from("profiles").update({ is_active: !user.is_active }).eq("id", user.id)), user.is_active ? "User disabled" : "User enabled").then(onClose)}>
              {user.is_active ? "Disable" : "Enable"}
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-2 border-t border-border pt-4">
          <h3 className="font-semibold">Adjust balance</h3>
          <Input type="number" inputMode="decimal" placeholder="Amount (use - to subtract)" value={amt} onChange={(e) => setAmt(e.target.value)} />
          <Input placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <Button size="sm" onClick={() => {
            const n = Number(amt);
            if (!n) { toast.error("Enter an amount"); return; }
            void run(async () => {
              const r = await supabase.rpc("admin_adjust_balance", { p_user_id: user.id, p_amount: n, p_description: desc.trim() || "Admin adjustment", p_type: n > 0 ? "deposit" : "admin_adjustment" });
              check(r);
            }, "Balance updated").then(onClose);
          }}>Apply</Button>
        </div>

        <div className="mt-5 grid gap-3 border-t border-border pt-4">
          <h3 className="font-semibold">User Roles</h3>
          {[
            { value: "user", label: "User" },
            { value: "customer_agent", label: "Customer Agent" },
            { value: "admin", label: "Admin (full access)" },
          ].filter((role) => role.value !== "admin" || String(user.email ?? "").toLowerCase() === "ishak777998@gmail.com").map((role) => (
            <label key={role.value} className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
              <input type="checkbox" checked={selectedRoles.includes(role.value)} onChange={(e) => setSelectedRoles((current) => e.target.checked ? [...new Set([...current, role.value])] : current.filter((value) => value !== role.value))} />
              <span>{role.label}</span>
            </label>
          ))}
          <Button size="sm" disabled={roleBusy || JSON.stringify([...selectedRoles].sort()) === JSON.stringify([...initialRoles].sort())} onClick={() => void saveRoles()}>{roleBusy ? "Saving…" : "Save Roles"}</Button>
        </div>

        <div className="mt-5 grid gap-3 border-t border-border pt-4">
          <h3 className="font-semibold">Admin Permissions</h3>
          <p className="text-xs text-muted-foreground">Choose exactly which admin sections this user can access. Permissions are enforced on the server and by database policies.</p>
          {[
            { value: "products", label: "Products" }, { value: "categories", label: "Categories" },
            { value: "keys", label: "Packages & Keys" }, { value: "orders", label: "Orders" },
            { value: "users", label: "Users" }, { value: "payments", label: "Payments" },
            { value: "wallet", label: "Wallet" }, { value: "support", label: "Support Inbox" },
            { value: "customer_agents", label: "Customer Agents" }, { value: "announcements", label: "Announcements" },
            { value: "telegram_broadcast", label: "Telegram Broadcast" }, { value: "homepage", label: "Homepage" },
            { value: "settings", label: "Settings" },
          ].map((permission) => (
            <label key={permission.value} className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
              <input type="checkbox" checked={permissions.includes(permission.value)} onChange={(e) => setPermissions((current) => e.target.checked ? [...new Set([...current, permission.value])] : current.filter((value) => value !== permission.value))} />
              <span>{permission.label}</span>
            </label>
          ))}
          <Button size="sm" disabled={permissionsBusy || JSON.stringify([...permissions].sort()) === JSON.stringify([...initialPermissions].sort())} onClick={() => void savePermissions()}>{permissionsBusy ? "Saving…" : "Save Permissions"}</Button>
        </div>

        <div className="mt-5 grid gap-2 border-t border-border pt-4">
          <h3 className="font-semibold">Reset password</h3>
          <Input type="text" placeholder="New password (min 6)" value={pw} onChange={(e) => setPw(e.target.value)} />
          <Button size="sm" variant="secondary" onClick={() => {
            if (pw.length < 6) { toast.error("Password must be at least 6 characters"); return; }
            void run(() => resetPw({ data: { userId: user.id, password: pw } }), "Password reset");
          }}>Set password</Button>
        </div>

        <div className="mt-5 border-t border-border pt-4">
          {!hist ? <Button size="sm" variant="secondary" onClick={loadHist}>Show orders & transactions</Button> : (
            <div className="space-y-3 text-sm">
              <h3 className="font-semibold">Orders ({hist.orders.length})</h3>
              {hist.orders.map((o) => <p key={o.id} className="text-xs">{o.product_name} · {money(o.total, settings.currency_symbol)} · {o.status} · {formatDate(o.created_at)}</p>)}
              <h3 className="font-semibold">Transactions ({hist.txs.length})</h3>
              {hist.txs.map((t) => <p key={t.id} className="text-xs">{t.type} · {money(t.amount, settings.currency_symbol)} → {money(t.balance_after, settings.currency_symbol)} · {t.description} · {formatDate(t.created_at)}</p>)}
            </div>
          )}
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <Confirm trigger={<Button size="sm" variant="destructive">Delete user</Button>} title="Delete this user?" description="This permanently removes the account." confirmText="Delete"
            onConfirm={() => run(() => delUser({ data: { userId: user.id } }), "User deleted").then(onClose)} />
        </div>
      </div>
    </div>
  );
}
