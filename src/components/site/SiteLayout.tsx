import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Home,
  KeyRound,
  LifeBuoy,
  LogOut,
  ShoppingBag,
  LayoutDashboard,
  LogIn,
  Package,
  ReceiptText,
  Shield,
  User,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Brand } from "@/components/site/Brand";
import { FloatingContact } from "@/components/site/ContactButtons";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSite";
import { money, tgLink, telLink, waLink } from "@/lib/site";

const bottomNav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/products", label: "Products", icon: Package },
  { to: "/dashboard/orders", label: "Orders", icon: ReceiptText },
  { to: "/dashboard/wallet", label: "Wallet", icon: Wallet },
  { to: "/dashboard/profile", label: "Profile", icon: User },
] as const;

export function SiteLayout({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const { user, profile, isAdmin } = useAuth();
  const wa = waLink(settings.whatsapp_number);
  const tg = tgLink(settings.telegram_username);

  return (
    <div className="mx-auto flex min-h-screen w-full min-w-0 max-w-lg flex-col overflow-x-hidden border-x border-border/60">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="flex h-14 w-full items-center justify-between gap-2 px-3">
          <Brand />
          {isAdmin && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin">
                <Shield className="h-4 w-4" /><span className="sr-only sm:not-sr-only">Admin</span>
              </Link>
            </Button>
          )}
          <div className="flex shrink-0 items-center gap-1.5">
            {user ? (
              <>
                <span className="whitespace-nowrap rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                  {money(profile?.balance, settings.currency_symbol)}
                </span>
                <ProfileMenu name={profile?.name || profile?.username || profile?.email || "Account"} email={profile?.email ?? ""} />
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

      <footer className="border-t border-border/70 bg-surface/60 pb-24 pt-10">
        <div className="grid w-full grid-cols-2 gap-8 px-4">
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

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur">
        <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2 py-1.5">
          {bottomNav.map(({ to, label, icon: Icon }) => (
            <li key={to} className="flex-1">
              <Link
                to={to}
                activeOptions={{ exact: to === "/" }}
                className="flex flex-col items-center gap-1 rounded-lg py-1.5 text-[11px] text-muted-foreground transition-colors data-[status=active]:bg-primary/10 data-[status=active]:text-primary"
              >
                <Icon className="h-5 w-5" />
                {label}
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

function ProfileMenu({ name, email }: { name: string; email: string }) {
  const { signOut } = useAuth();
  const items = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/products", label: "Products", icon: Package },
    { to: "/dashboard/orders", label: "My Orders", icon: ReceiptText },
    { to: "/dashboard/purchases", label: "Purchased", icon: ShoppingBag },
    { to: "/dashboard/wallet", label: "Wallet", icon: Wallet },
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
          <p className="truncate text-sm font-semibold">{name}</p>
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
