import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, RowSkeleton } from "@/components/site/States";
import { SupportThread, StatusBadge } from "@/components/site/SupportThread";

export const Route = createFileRoute("/_authenticated/admin/support")({
  head: () => ({ meta: [{ title: "Support Tickets — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminSupport,
});

function AdminSupport() {
  const [filter, setFilter] = useState<"open" | "resolved" | "all">("open");
  const [openId, setOpenId] = useState<string | null>(null);
  const tickets = useQuery({
    queryKey: ["tickets", "admin", filter],
    queryFn: async () => {
      let q = supabase.from("support_tickets").select("*, profiles(name,email,username)").order("created_at", { ascending: false });
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Support Tickets</h1>
      <div className="flex gap-2">
        {(["open", "resolved", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 text-sm capitalize ${filter === f ? "bg-primary text-primary-foreground" : "bg-surface-2 text-muted-foreground"}`}>{f}</button>
        ))}
      </div>
      {tickets.isLoading ? <RowSkeleton /> : (tickets.data ?? []).length === 0 ? <EmptyState title="কোনো টিকিট নেই" /> : tickets.data!.map((t) => (
        <div key={t.id} className="panel p-3">
          <button className="w-full text-left" onClick={() => setOpenId(openId === t.id ? null : t.id)}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{t.subject}</span>
              <StatusBadge status={t.status} />
            </div>
            <p className="truncate text-xs text-muted-foreground">{t.profiles?.name || t.profiles?.username} · {t.profiles?.email}</p>
          </button>
          {openId === t.id && <div className="mt-3"><SupportThread ticket={t} admin /></div>}
        </div>
      ))}
    </div>
  );
}
