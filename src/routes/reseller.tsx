import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, Check, KeyRound, ShieldCheck, Sparkles, Users } from "lucide-react";
import { SiteLayout, PageHeader } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/reseller")({
  head: () => ({
    meta: [
      { title: "Reseller Dashboard — PANEL BAZAR BD" },
      { name: "description", content: "Explore Normal and Pro Reseller Dashboard benefits, pricing and activation requirements." },
      { name: "robots", content: "index,follow" },
      { property: "og:title", content: "Reseller Dashboard — PANEL BAZAR BD" },
      { property: "og:description", content: "Explore reseller membership benefits and pricing." },
      { property: "og:url", content: "https://panelbazarbd.shop/reseller" },
    ],
    links: [{ rel: "canonical", href: "https://panelbazarbd.shop/reseller" }],
  }),
  component: PublicResellerPage,
});

function PublicResellerPage() {
  const { user, loading: authLoading } = useAuth();

  return (
    <SiteLayout>
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:py-9">
        <PageHeader title="Reseller Dashboard" description="Membership, সুবিধা, মূল্য এবং Activation-এর নিয়ম — অ্যাকাউন্ট ছাড়াই দেখে নিন।" />
        <section className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background p-5 sm:p-8">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary"><Sparkles className="h-4 w-4" /> PANEL BAZAR BD RESELLER PROGRAM</div>
          <h1 className="mt-3 max-w-2xl text-2xl font-black tracking-tight sm:text-4xl">আরও ভালো দামে পণ্য কিনুন, Reseller সুবিধা ব্যবহার করুন</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Normal এবং Pro Reseller membership-এর সুবিধা, package price, panel price comparison এবং activation process সবার জন্য উন্মুক্ত। কেনা বা membership চালু করতে account-এ Login করতে হবে।</p>
          {!authLoading && (
            <div className="mt-5 flex flex-wrap gap-2">
              {user ? (
                <Button asChild><Link to="/dashboard/reseller">Go to Reseller Dashboard</Link></Button>
              ) : (
                <>
                  <Button asChild><Link to="/auth" search={{ mode: "register" }}>Create Account</Link></Button>
                  <Button asChild variant="outline"><Link to="/auth" search={{ mode: "login" }}>Login</Link></Button>
                </>
              )}
            </div>
          )}
        </section>
        <div className="grid gap-4 md:grid-cols-2">
          <section className="panel space-y-4 p-5">
            <div className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /><h2 className="text-lg font-bold">Normal Reseller Dashboard</h2></div>
            <p className="text-3xl font-black">৳৩০০</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-primary" /> Admin-configured reseller discount</li>
              <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-primary" /> Reseller Dashboard access</li>
              <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-primary" /> Reseller account badge</li>
            </ul>
          </section>
          <section className="panel space-y-4 p-5">
            <div className="flex items-center gap-2"><BadgeCheck className="h-5 w-5 text-primary" /><h2 className="text-lg font-bold">Pro Reseller Dashboard</h2></div>
            <p className="text-3xl font-black">৳২৫০ <span className="text-sm font-medium text-muted-foreground">package fee</span></p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-primary" /> Pro pricing and verified badge after activation</li>
              <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-primary" /> প্রতি মাসের ১ তারিখে ৭ দিনের free Panel access (বালা মোড ও Troll মোড ছাড়া)</li>
              <li className="flex gap-2"><KeyRound className="h-4 w-4 shrink-0 text-primary" /> Panel-এর Device অথবা Key Reset সুবিধা</li>
              <li className="flex gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-primary" /> Pro activation ও প্রতি ১৫ দিনের cycle-এর জন্য নতুন ৳৫০০ qualifying deposit এবং Verify</li>
            </ul>
            <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">Pro membership চালু করতে আগে Normal Reseller Dashboard active থাকতে হবে। আগে Normal কিনুন, অথবা নিচের Bundle দিয়ে দুটো একসঙ্গে নিন।</p>
          </section>
        </div>
        <section className="panel space-y-3 p-5">
          <h2 className="text-lg font-bold">একসঙ্গে Normal + Pro</h2>
          <p className="text-3xl font-black">৳৫০০</p>
          <p className="text-sm text-muted-foreground">যাদের Normal Reseller Dashboard নেই, তারা Bundle নিয়ে Normal Dashboard ও Pro package একসঙ্গে নিতে পারবেন। Normal access সঙ্গে সঙ্গে active হবে; Pro access চালু করতে package purchase-এর পর প্রয়োজনীয় নতুন qualifying Deposit মোট ৳৫০০ পূরণ করে Verify করতে হবে।</p>
          {!authLoading && (user
            ? <Button asChild><Link to="/dashboard/reseller">Go to Reseller Dashboard</Link></Button>
            : <Button asChild><Link to="/auth" search={{ mode: "register" }}>Register to Activate</Link></Button>
          )}
        </section>
        <section className="panel space-y-3 p-5">
          <h2 className="text-lg font-bold">Product, Price List ও Panel Access Information</h2>
          <p className="text-sm text-muted-foreground">Login ছাড়াই সব Public Product, Duration / Validity, Normal / Reseller / Pro price list, product features এবং product description দেখা যাবে। Buy Now থেকে price list দেখে account তৈরি বা Login করে purchase continue করা যাবে।</p>
          <p className="text-sm text-muted-foreground">Order সম্পন্ন হওয়ার পর ব্যক্তিগত Access Key / Code, purchased items, order history ও wallet তথ্য account-এর ভেতরে নিরাপদে থাকবে—এগুলো অন্য visitor দেখতে পারবে না।</p>
        </section>
        <section className="rounded-2xl border border-border p-5">
          <h2 className="font-bold">Pro Activation-এর নিয়ম</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Pro package fee ৳২৫০ আলাদা; activation-এর ৳৫০০ আলাদা।</li>
            <li>প্রথম activation-এর জন্য নতুন qualifying Deposit মোট ৳৫০০ পূরণ করতে হবে। Verify করলে Wallet থেকে কোনো টাকা কাটা হবে না।</li>
            <li>প্রতি ১৫ দিনের পরবর্তী cycle-এ নতুন করে ৳৫০০ deposit করতে হবে; আগের cycle-এর deposit গণনা হবে না।</li>
            <li>একাধিক deposit যোগ হয়ে ৳৫০০ হতে পারে; প্রতিটি deposit-এর minimum ৳৫০।</li>
            <li>১৫ দিনের মধ্যে নতুন deposit পূরণ করে Verify না করলে Pro access বন্ধ হয়ে Normal Reseller Dashboard-এ downgrade হবে। পরে নতুন deposit করে আবার Pro চালু করা যাবে।</li>
          </ul>
        </section>
        <p className="text-center text-xs text-muted-foreground">Public page-এ membership-এর তথ্য ও benefits দেখা যাবে। Account, wallet, orders, purchase এবং ব্যক্তিগত তথ্য শুধু Login করার পর accessible হবে।</p>
      </div>
    </SiteLayout>
  );
}
