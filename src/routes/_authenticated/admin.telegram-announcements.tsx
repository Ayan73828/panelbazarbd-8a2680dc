import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AdminHeader, Field } from "@/components/admin/kit";
import { Confirm, errMsg } from "@/components/site/Confirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { adminTelegramBroadcast } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/telegram-announcements")({
  component: TelegramAnnouncements,
});

function TelegramAnnouncements() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const broadcast = useServerFn(adminTelegramBroadcast);

  const sendAnnouncement = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Title and message are both required");
      return;
    }
    setSending(true);
    try {
      const result = await broadcast({ data: { title: title.trim(), message: message.trim() } });
      toast.success(`Telegram announcement sent. Delivered: ${result.sent}; failed: ${result.failed}; total: ${result.total}`);
      setTitle("");
      setMessage("");
    } catch (error) {
      toast.error(errMsg(error));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <AdminHeader
        title="Telegram Broadcast"
        description="Send an announcement directly to users who have started your Telegram bot."
      />
      <div className="panel grid gap-4 p-4">
        <Field label="Announcement title">
          <Input maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Important update" />
        </Field>
        <Field label="Message" hint="Maximum 3,500 characters. Telegram will receive the title and message together.">
          <Textarea rows={6} maxLength={3500} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write your announcement here…" />
        </Field>
        <p className="text-xs text-muted-foreground">
          This sends a Telegram message to saved bot chats. Users who have never started the bot or have blocked it may not receive the message.
        </p>
        <Confirm
          trigger={<Button disabled={sending || !title.trim() || !message.trim()}>{sending ? "Sending…" : "Send to all Telegram users"}</Button>}
          title="Send Telegram announcement to everyone?"
          description="This will send the message to all saved Telegram bot chats. This action cannot be undone."
          confirmText="Send announcement"
          destructive={false}
          onConfirm={sendAnnouncement}
        />
      </div>
    </div>
  );
}
