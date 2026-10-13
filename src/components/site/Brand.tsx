import { Link } from "@tanstack/react-router";
import { useSettings } from "@/hooks/useSite";

export function Brand({ compact = false }: { compact?: boolean }) {
  const { settings } = useSettings();
  return (
    <Link to="/" className="flex min-w-0 items-center gap-2">
      <img
        src="https://cdn.phototourl.com/member/2026-10-13-bdaa5c4b-3f94-46db-a14a-abc485bc7483.png"
        alt={settings.site_name || "PANEL BAZAR BD"}
        width={36}
        height={36}
        loading="eager"
        decoding="async"
        className="h-9 w-9 shrink-0 rounded-lg object-contain"
      />
      <span
        className={`truncate font-semibold tracking-tight ${compact ? "text-sm" : "text-base sm:text-lg"}`}
      >
        {settings.site_name}
      </span>
    </Link>
  );
}
