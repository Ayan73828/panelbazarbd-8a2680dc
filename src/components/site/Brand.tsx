import { Link } from "@tanstack/react-router";
import { useSettings } from "@/hooks/useSite";

export function Brand({ compact = false }: { compact?: boolean }) {
  const { settings } = useSettings();
  return (
    <Link to="/" className="flex min-w-0 items-center">
      <span className={`truncate font-semibold tracking-tight ${compact ? "text-sm" : "text-base sm:text-lg"}`}>
        {settings.site_name || "PANEL BAZAR BD"}
      </span>
    </Link>
  );
}
