import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/dashboard/referral")({
  component: ReferralPage,
});

function ReferralPage() {
  const { profile } = useAuth();
  const referralLink = useMemo(() => profile?.id ? `${window.location.origin}/auth?mode=register&ref=${profile.id}` : "", [profile?.id]);
  const referrals = useQuery({
    queryKey: ["my-referrals", profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const { data, error } = await supabase.from("referrals").select("id,referred_user_id,reward_amount,created_at").eq("referrer_id", profile!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(referralLink);
      toast.success("Referral link copied!");
    } catch {
      toast.error("Copy failed. Please select and copy the link manually.");
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Referral Program" description="Invite new customers and earn ৳5 for every successful new referral." />
      <section className="panel space-y-3 p-5">
        <p className="text-sm text-muted-foreground">Your personal referral link</p>
        <div className="break-all rounded-xl border border-border bg-surface-2 p-3 text-sm">{referralLink || "Loading your referral link…"}</div>
        <Button onClick={copyLink} disabled={!referralLink} className="w-full rounded-full">Copy referral link</Button>
        <p className="text-xs text-muted-foreground">Reward is added once when a new user registers through your link. Self-referrals and duplicate rewards are not allowed.</p>
      </section>
      <section className="panel p-5">
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-sm text-muted-foreground">Successful referrals</p><p className="text-2xl font-bold">{referrals.data?.length ?? 0}</p></div>
          <div className="text-right"><p className="text-sm text-muted-foreground">Rewards earned</p><p className="text-2xl font-bold">৳{(referrals.data ?? []).reduce((sum, item) => sum + Number(item.reward_amount), 0).toFixed(2)}</p></div>
        </div>
      </section>
      <section className="panel p-5">
        <h2 className="mb-3 font-semibold">Referral history</h2>
        {referrals.isLoading ? <p className="text-sm text-muted-foreground">Loading referrals…</p> : referrals.error ? <p className="text-sm text-destructive">Could not load referral history.</p> : !referrals.data?.length ? <p className="text-sm text-muted-foreground">No successful referrals yet.</p> : <div className="space-y-3">{referrals.data.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 border-b border-border pb-3 last:border-0"><div><p className="text-sm font-medium">New referral</p><p className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</p></div><p className="font-semibold text-primary">+৳{Number(item.reward_amount).toFixed(2)}</p></div>)}</div>}
      </section>
    </div>
  );
}
