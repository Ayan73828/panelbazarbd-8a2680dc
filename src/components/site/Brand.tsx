import { Link } from "@tanstack/react-router";
import { useSettings } from "@/hooks/useSite";

export function Brand({ compact = false }: { compact?: boolean }) {
  const { settings } = useSettings();
  return (
    <Link to="/" className="flex min-w-0 items-center gap-2">
      <img
        src="https://i.postimg.cc/rpr3MqDF/DB0CEC8E-0596-4BC9-BAA0-2A4C387AE71E.png"
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
