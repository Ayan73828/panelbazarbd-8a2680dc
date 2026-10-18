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
        className={compact ? "h-7 w-auto max-w-28 object-contain" : "h-9 w-auto max-w-40 object-contain"}
        loading="eager"
        onError={(event) => { event.currentTarget.style.display = "none"; }}
      />
      <span className={`truncate font-semibold tracking-tight ${compact ? "text-sm" : "text-base sm:text-lg"}`}>
        {settings.site_name || "PANEL BAZAR BD"}
      </span>
    </Link>
  );
}
