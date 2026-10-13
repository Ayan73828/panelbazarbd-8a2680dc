import { Link } from "@tanstack/react-router";
import { useSettings } from "@/hooks/useSite";

const OFFICIAL_LOGO_URL = "https://i.postimg.cc/rpr3MqDF/DB0CEC8E-0596-4BC9-BAA0-2A4C387AE71E.png?v=official-20261013";

export function Brand({ compact = false }: { compact?: boolean }) {
  const { settings } = useSettings();
  return (
    <Link to="/" className="flex min-w-0 items-center gap-2">
      <img
        src={OFFICIAL_LOGO_URL}
        alt={settings.site_name || "PANEL BAZAR BD"}
        width={36}
        height={36}
        loading="eager"
        decoding="async"
        referrerPolicy="no-referrer"
        className="h-9 w-9 shrink-0 rounded-lg object-contain"
        onError={(event) => {
          const image = event.currentTarget;
          if (!image.src.includes("i.postimg.cc/rpr3MqDF")) image.src = OFFICIAL_LOGO_URL;
          else image.style.visibility = "hidden";
        }}
      />
      <span
        className={`truncate font-semibold tracking-tight ${compact ? "text-sm" : "text-base sm:text-lg"}`}
      >
        {settings.site_name}
      </span>
    </Link>
  );
}
