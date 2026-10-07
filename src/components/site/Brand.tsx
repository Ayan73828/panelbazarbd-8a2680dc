import { Link } from "@tanstack/react-router";
import { Zap } from "lucide-react";
import { useSettings } from "@/hooks/useSite";

export function Brand({ compact = false }: { compact?: boolean }) {
  const { settings } = useSettings();
  return (
    <Link to="/" className="flex min-w-0 items-center gap-2">
      {settings.logo_url ? (
        <img
          src={settings.logo_url}
          alt={settings.site_name}
          className="h-9 w-9 rounded-lg object-cover"
        />
      ) : (
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Zap className="h-5 w-5" />
        </span>
      )}
      <span
        className={`truncate font-semibold tracking-tight ${compact ? "text-sm" : "text-base sm:text-lg"}`}
      >
        {settings.site_name}
      </span>
    </Link>
  );
}
