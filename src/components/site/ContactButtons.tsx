import { MessageCircle, Send } from "lucide-react";
import { useSettings } from "@/hooks/useSite";
import { tgLink, waLink } from "@/lib/site";

export function FloatingContact() {
  const { settings } = useSettings();
  const wa = waLink(settings.whatsapp_number, `Hello ${settings.site_name}, I need help.`);
  const tg = tgLink(settings.telegram_username);
  if (!wa && !tg) return null;

  return (
    <div className="fixed bottom-24 right-4 z-40 flex flex-col gap-3 md:bottom-6">
      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noreferrer"
          aria-label="Chat on WhatsApp"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-success text-background shadow-panel transition-transform hover:scale-105"
        >
          <MessageCircle className="h-6 w-6" />
        </a>
      )}
      {tg && (
        <a
          href={tg}
          target="_blank"
          rel="noreferrer"
          aria-label="Chat on Telegram"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-panel transition-transform hover:scale-105"
        >
          <Send className="h-5 w-5" />
        </a>
      )}
    </div>
  );
}
