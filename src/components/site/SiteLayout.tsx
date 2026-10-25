import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Home,
  Bell,
  BadgeCheck,
  ShieldCheck,
  Crown,
  Sparkles,
  Gift,
  KeyRound,
  LifeBuoy,
  LogOut,
  ShoppingBag,
  ShoppingCart,
  Store,
  LayoutDashboard,
  LogIn,
  Package,
  ReceiptText,
  Shield,
  User,
  Wallet,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Brand } from "@/components/site/Brand";
import { FloatingContact } from "@/components/site/ContactButtons";
import { SupportChat } from "@/components/site/SupportChat";
import { useAuth } from "@/hooks/useAuth";
import { useActiveAnnouncements, useSettings } from "@/hooks/useSite";
import { useMyOrders, useMyTransactions } from "@/hooks/useMyData";
import { money, tgLink, telLink, waLink } from "@/lib/site";
import { useEffect, useState } from "react";
import { getCartCount } from "@/lib/cart";

const bottomNav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/products", label: "Products", icon: Package },
  { to: "/dashboard/orders", label: "Orders", icon: ReceiptText },
  { to: "/dashboard/wallet", label: "Wallet", icon: Wallet },
  { to: "/dashboard/profile", label: "Profile", icon: User },
] as const;

export function SiteLayout({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const { user, profile, isAdmin, isOwner, loading: authLoading } = useAuth();
  const orders = useMyOrders();
  const transactions = useMyTransactions();
  const announcements = useActiveAnnouncements();
  const notificationItems = [
    ...(transactions.data ?? []).map((tx) => ({
      id: `tx-${tx.id}`,
      title: tx.type === "referral_reward" ? "Referral reward received" : tx.type === "deposit" || tx.type === "add_funds" ? "Wallet balance updated" : tx.type === "purchase" ? "Purchase activity" : "Wallet activity",
      // Never expose internal transaction descriptions (provider names, refund reasons, or order IDs) in customer-facing notifications.
      message: tx.type === "referral_reward"
        ? "You received a referral reward."
        : tx.type === "deposit" || tx.type === "add_funds"
          ? "Your wallet balance has been updated."
          : tx.type === "purchase"
            ? "Your purchase activity has been updated."
            : "Your wallet activity has been updated.",
      createdAt: tx.created_at,
      kind: tx.type === "referral_reward" ? "referral" as const : "wallet" as const,
    })),
    ...(orders.data ?? []).slice(0, 5).map((order) => ({
      id: `order-${order.id}`,
      title: "Order update",
      message: `Your order status is ${order.status}.`,
      createdAt: order.created_at,
      kind: "order" as const,
    })),
    ...(announcements.data ?? []).filter((notice) => notice.type !== "popup").map((notice) => ({
      id: `announcement-${notice.id}`,
      title: notice.title,
      message: notice.message,
      createdAt: notice.created_at,
      kind: "announcement" as const,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);
  const wa = waLink(settings.whatsapp_number);
  const tg = tgLink(settings.telegram_username);
  const [cartCount, setCartCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [loadedNotificationsStorageKey, setLoadedNotificationsStorageKey] = useState<string | null>(null);
  const readNotificationsStorageKey = `panelbazarbd:read-notifications:${user?.id ?? "guest"}`;
  const unreadNotificationCount = notificationItems.filter((item) => !readNotificationIds.includes(item.id)).length;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(readNotificationsStorageKey);
      const parsed: unknown = saved ? JSON.parse(saved) : [];
      setReadNotificationIds(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
    } catch {
      setReadNotificationIds([]);
    } finally {
      setLoadedNotificationsStorageKey(readNotificationsStorageKey);
    }
  }, [readNotificationsStorageKey]);

  useEffect(() => {
    if (loadedNotificationsStorageKey !== readNotificationsStorageKey) return;
    try {
      window.localStorage.setItem(readNotificationsStorageKey, JSON.stringify(readNotificationIds));
    } catch {
      // Keep notification interactions working if browser storage is unavailable.
    }
  }, [readNotificationIds, loadedNotificationsStorageKey, readNotificationsStorageKey]);

  const markNotificationRead = (id: string) => {
    setReadNotificationIds((current) => current.includes(id) ? current : [...current, id]);
  };
  const markAllNotificationsRead = () => {
    setReadNotificationIds((current) => [...new Set([...current, ...notificationItems.map((item) => item.id)])]);
  };
  useEffect(() => {
    const update = () => setCartCount(getCartCount());
    update();
    window.addEventListener("cart-updated", update);
    window.addEventListener("storage", update);
    return () => { window.removeEventListener("cart-updated", update); window.removeEventListener("storage", update); };
  }, []);

  return (
    <div className="mx-auto flex min-h-screen w-full min-w-0 max-w-7xl flex-col overflow-x-hidden bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 shadow-sm shadow-black/[0.03] backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full items-center justify-between gap-3 px-3 sm:px-5 lg:px-7">
          <Brand compact />
          {isAdmin && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin">
                <Shield className="h-4 w-4" /><span className="sr-only sm:not-sr-only">Admin</span>
              </Link>
            </Button>
          )}
          <div className="flex shrink-0 items-center gap-1.5">
            {user && (
              <>
              <Button asChild variant="ghost" size="icon" className="header-action-button relative overflow-visible" aria-label="Shopping cart"><Link to="/cart"><ShoppingCart className="h-5 w-5" />{cartCount > 0 && <span className="pointer-events-none absolute -right-1 -top-1 z-20 flex h-4 min-w-4 items-center justify-center rounded-full border border-background bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground shadow-sm">{cartCount > 99 ? "99+" : cartCount}</span>}</Link></Button>
              <DropdownMenu open={notificationsOpen} onOpenChange={setNotificationsOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="header-action-button relative overflow-visible" aria-label="Notifications">
                    <Bell className="h-5 w-5" />
                    {unreadNotificationCount > 0 && <span className="pointer-events-none absolute -right-1 -top-1 z-20 flex h-4 min-w-4 items-center justify-center rounded-full border border-background bg-destructive px-1 text-[10px] font-bold leading-none text-white shadow-sm">{unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}</span>}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-1.5rem))]">
                  <DropdownMenuLabel className="flex items-center justify-between gap-2"><span>Notifications</span><span className="text-xs font-normal text-muted-foreground">{unreadNotificationCount} unread</span></DropdownMenuLabel>
                  {notificationItems.length > 0 && <div className="px-2 pb-2"><Button type="button" variant="outline" size="sm" className="w-full" disabled={unreadNotificationCount === 0} onClick={markAllNotificationsRead}>Read All Messages</Button></div>}
                  <DropdownMenuSeparator />
                  {notificationItems.length === 0 ? <div className="px-2 py-5 text-center text-sm text-muted-foreground">No notifications yet.</div> : <div className="max-h-[60vh] overflow-y-auto">{notificationItems.map((item) => {
                    const isRead = readNotificationIds.includes(item.id);
                    return <button type="button" key={item.id} onClick={() => markNotificationRead(item.id)} className={`flex w-full gap-2 border-b border-border/60 px-2 py-3 text-left last:border-0 hover:bg-muted/60 ${isRead ? "opacity-65" : "bg-primary/5"}`} aria-label={`${item.title}, ${isRead ? "read" : "unread"}`}>
                      <span className="mt-0.5 text-primary">{item.kind === "referral" ? <Gift className="h-4 w-4" /> : item.kind === "wallet" ? <Wallet className="h-4 w-4" /> : item.kind === "order" ? <ReceiptText className="h-4 w-4" /> : <Bell className="h-4 w-4" />}</span>
                      <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{item.title}</span>{!isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}</span><span className="block text-xs text-muted-foreground">{item.message}</span><span className="mt-1 block text-[10px] text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</span></span>
                    </button>;
                  })}</div>}
                </DropdownMenuContent>
              </DropdownMenu>
              </>
            )}
            <HeaderMusicToggle />
            {authLoading ? (
              // Reserve the account controls while Supabase restores the session.
              // This prevents Register/Login from flashing before the signed-in profile appears.
              <div className="h-9 w-[5.5rem] shrink-0" aria-hidden="true" />
            ) : user ? (
              <>
                <span className="whitespace-nowrap rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                  {money(profile?.balance, settings.currency_symbol)}
                </span>
                <ProfileMenu name={profile?.name || profile?.username || profile?.email || "Account"} email={profile?.email ?? ""} isReseller={!!profile?.is_reseller} isAdmin={isAdmin} isOwner={isOwner} />
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/auth" search={{ mode: "register" }}>
                    Register
                  </Link>
                </Button>
                <Button asChild size="sm" className="rounded-full">
                  <Link to="/auth" search={{ mode: "login" }}>
                    <LogIn className="mr-1 h-4 w-4" /> Login
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="min-w-0 flex-1 overflow-x-hidden pb-24">{children}</main>

      <footer className="border-t border-border/70 bg-gradient-to-b from-surface/70 to-background pb-24 pt-12">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-x-6 gap-y-9 px-4 sm:gap-x-10 sm:px-6 lg:grid-cols-4 lg:px-8">
          <div className="space-y-3">
            <Brand />
            <p className="text-sm text-muted-foreground">{settings.footer_text}</p>
          </div>
          <div className="space-y-2 text-sm">
            <h4 className="text-sm font-semibold">Explore</h4>
            <Link to="/products" className="block text-muted-foreground hover:text-foreground">
              Products
            </Link>
            <Link
              to="/products"
              search={{ category: undefined, q: undefined, sort: undefined }}
              className="block text-muted-foreground hover:text-foreground"
            >
              Categories
            </Link>
          </div>
          <div className="space-y-2 text-sm">
            <h4 className="text-sm font-semibold">Account</h4>
            <Link
              to="/auth"
              search={{ mode: "login" }}
              className="block text-muted-foreground hover:text-foreground"
            >
              Login
            </Link>
            <Link
              to="/auth"
              search={{ mode: "register" }}
              className="block text-muted-foreground hover:text-foreground"
            >
              Register
            </Link>
            <Link to="/dashboard" className="block text-muted-foreground hover:text-foreground">
              Dashboard
            </Link>
          </div>
          <div className="space-y-2 text-sm" id="contact">
            <h4 className="text-sm font-semibold">Contact</h4>
            {settings.contact_phone && (
              <a
                href={telLink(settings.contact_phone)}
                className="block text-muted-foreground hover:text-foreground"
              >
                Call: {settings.contact_phone}
              </a>
            )}
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                className="block text-muted-foreground hover:text-foreground"
              >
                WhatsApp: {settings.whatsapp_number}
              </a>
            )}
            {tg && (
              <a
                href={tg}
                target="_blank"
                rel="noreferrer"
                className="block text-muted-foreground hover:text-foreground"
              >
                Telegram: @{settings.telegram_username.replace(/^@/, "")}
              </a>
            )}
            {settings.contact_email && (
              <a
                href={`mailto:${settings.contact_email}`}
                className="block text-muted-foreground hover:text-foreground"
              >
                {settings.contact_email}
              </a>
            )}
          </div>
        </div>
        <div className="mt-8 w-full border-t border-border/60 px-4 pt-4 text-xs text-muted-foreground">
          {settings.footer_copyright}
        </div>
      </footer>

      <FloatingContact />
      <SupportChat />

      <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 pointer-events-none">
        <ul className="mx-auto flex max-w-lg items-stretch justify-between gap-1 rounded-[1.6rem] border border-white/50 bg-background/70 px-2 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.16),inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-2xl supports-[backdrop-filter]:bg-background/55 pointer-events-auto dark:border-white/15 dark:shadow-[0_8px_32px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.12)]">
          {bottomNav.map(({ to, label, icon: Icon }) => (
            <li key={to} className="min-w-0 flex-1">
              <Link
                to={to}
                activeOptions={{ exact: to === "/" }}
                className="group relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl border border-transparent px-1 py-1.5 text-[10px] font-medium text-muted-foreground transition-all duration-200 hover:bg-white/25 hover:text-foreground active:scale-95 data-[status=active]:border-white/45 data-[status=active]:bg-white/55 data-[status=active]:text-primary data-[status=active]:shadow-[0_2px_10px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] dark:hover:bg-white/10 dark:data-[status=active]:border-white/15 dark:data-[status=active]:bg-white/10 dark:data-[status=active]:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <Icon className="h-[1.2rem] w-[1.2rem] transition-transform duration-200 group-data-[status=active]:-translate-y-0.5" strokeWidth={1.8} />
                <span className="max-w-full truncate leading-none">{label === "Orders" ? "Order" : label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  right,
}: {
  title: string;
  description?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {right}
    </div>
  );
}

function ProfileMenu({ name, email, isReseller, isAdmin, isOwner }: { name: string; email: string; isReseller: boolean; isAdmin: boolean; isOwner: boolean }) {
  const { signOut } = useAuth();
  const items = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/products", label: "Products", icon: Package },
    { to: "/dashboard/orders", label: "My Orders", icon: ReceiptText },
    { to: "/dashboard/purchases", label: "Purchased", icon: ShoppingBag },
    { to: "/dashboard/wallet", label: "Wallet", icon: Wallet },
    { to: "/dashboard/reseller", label: isReseller ? "Reseller Dashboard" : "Upgrade to Reseller Dashboard", icon: Store },
    { to: "/dashboard/profile", label: "Profile", icon: User },
    { to: "/dashboard/password", label: "Password", icon: KeyRound },
    { to: "/dashboard/support", label: "Support", icon: LifeBuoy },
  ] as const;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="rounded-full" aria-label="Account menu">
          <User className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm font-semibold">
            <span className="truncate">{name}</span>
            {isOwner ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400/50 bg-gradient-to-r from-amber-300/25 via-yellow-200/20 to-orange-400/25 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-amber-600 shadow-sm">
                <Crown className="h-3 w-3 animate-pulse fill-amber-400/30" /> KING
                <Sparkles className="h-3 w-3 animate-pulse" />
              </span>
            ) : isAdmin ? (
              <ShieldCheck className="h-[17px] w-[17px] shrink-0 fill-blue-500/15 text-blue-500" aria-label="Verified admin" title="Verified admin" />
            ) : isReseller ? (
              <BadgeCheck className="h-[17px] w-[17px] shrink-0 fill-emerald-500/15 text-emerald-500" aria-label="Verified reseller" title="Verified reseller" />
            ) : null}
          </p>
          <p className="truncate text-xs font-normal text-muted-foreground">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map(({ to, label, icon: Icon }) => (
          <DropdownMenuItem key={to} asChild>
            <Link to={to}><Icon className="mr-2 h-4 w-4" /> {label}</Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive" onSelect={() => { void signOut(); }}>
          <LogOut className="mr-2 h-4 w-4" /> Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Starts music automatically where browser policy permits; otherwise retries after the first user interaction. */
function HeaderMusicToggle() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const audio = document.getElementById("panelbazarbd-background-music") as HTMLAudioElement | null;
    if (!audio) return;
    audio.loop = true;
    audio.preload = "auto";

    const isMusicDisabled = () => {
      try { return window.localStorage.getItem("panelbazarbd_music_disabled") === "true"; }
      catch { return false; }
    };
    if (isMusicDisabled()) {
      audio.pause();
      setEnabled(false);
      return;
    }

    const startMusic = () => {
      if (isMusicDisabled() || !audio.paused) return;
      void audio.play().then(() => setEnabled(true)).catch(() => {
        // Autoplay with sound is blocked by some browsers until the visitor interacts.
        setEnabled(false);
      });
    };

    startMusic();
    const retryAfterInteraction = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-music-toggle]")) return;
      startMusic();
      if (!audio.paused) {
        window.removeEventListener("pointerdown", retryAfterInteraction, true);
        window.removeEventListener("keydown", retryAfterInteraction, true);
      }
    };
    window.addEventListener("pointerdown", retryAfterInteraction, true);
    window.addEventListener("keydown", retryAfterInteraction, true);
    return () => {
      window.removeEventListener("pointerdown", retryAfterInteraction, true);
      window.removeEventListener("keydown", retryAfterInteraction, true);
    };
  }, []);

  const toggleMusic = () => {
    const audio = document.getElementById("panelbazarbd-background-music") as HTMLAudioElement | null;
    if (!audio) return;
    if (enabled || !audio.paused) {
      audio.pause();
      setEnabled(false);
      try { window.localStorage.setItem("panelbazarbd_music_disabled", "true"); } catch {}
      return;
    }
    try { window.localStorage.removeItem("panelbazarbd_music_disabled"); } catch {}
    void audio.play().then(() => setEnabled(true)).catch(() => setEnabled(false));
  };

  return (
    <>
      <audio id="panelbazarbd-background-music" src="https://standard-plum-2cflgaxh.edgeone.dev/" loop preload="auto" />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        data-music-toggle="true"
        onClick={toggleMusic}
        aria-label={enabled ? "Turn music off" : "Turn music on"}
        title={enabled ? "Music On — tap to turn off" : "Music Off — tap to turn on"}
        className="shrink-0"
      >
        {enabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
      </Button>
    </>
  );
}

