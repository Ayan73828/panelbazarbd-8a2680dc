import { Link } from "@tanstack/react-router";
import { useSettings } from "@/hooks/useSite";

const officialLogoUrl = "https://cdn.phototourl.com/member/2026-10-18-95f8a910-7c5e-4ec3-a35c-a352f0d7532c.png";

export function Brand({ compact = false }: { compact?: boolean }) {
  const { settings } = useSettings();
  return (
    <Link to="/" className="flex min-w-0 items-center gap-2">
      <img
        src={officialLogoUrl}
        alt={settings.site_name || "PANEL BAZAR BD"}
        className={compact
          ? "h-10 w-auto max-w-36 rounded-lg object-contain sm:h-11 sm:max-w-40"
          : "h-11 w-auto max-w-40 rounded-lg object-contain sm:h-12 sm:max-w-44"}
        loading="eager"
        onError={(event) => { event.currentTarget.style.display = "none"; }}
      />
      {!compact && <span className="truncate text-base font-semibold tracking-tight sm:text-lg">{settings.site_name || "PANEL BAZAR BD"}</span>}
    </Link>
  );
}
