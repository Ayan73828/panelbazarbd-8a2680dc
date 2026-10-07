import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AdminHeader, db, Loadable, SettingsForm, SwitchField, useInvalidateAll, useTable } from "@/components/admin/kit";
import { errMsg } from "@/components/site/Confirm";

export const Route = createFileRoute("/_authenticated/admin/homepage")({ component: AdminHomepage });

function AdminHomepage() {
  const sections = useTable("homepage_sections", "sort_order", true);
  const invalidate = useInvalidateAll();
  return (
    <div className="space-y-6">
      <AdminHeader title="Homepage" description="Hero text, notice and which sections show." />
      <SettingsForm fields={[
        { key: "hero_title", label: "Hero title" },
        { key: "hero_button_text", label: "Button text" },
        { key: "hero_button_url", label: "Button link" },
        { key: "hero_image_url", label: "Hero image URL" },
        { key: "hero_subtitle", label: "Hero subtitle", type: "textarea" },
        { key: "announcement_text", label: "Announcement text", type: "textarea" },
      ]} />
      <h2 className="font-semibold">Sections</h2>
      <Loadable q={sections}>
        <div className="grid gap-2">
          {(sections.data ?? []).map((s) => (
            <SwitchField key={s.id} label={s.title || s.key} checked={s.is_enabled} onChange={async (v) => {
              const { error } = await db.from("homepage_sections").update({ is_enabled: v }).eq("id", s.id);
              if (error) { toast.error(errMsg(error)); return; }
              toast.success("Updated");
              invalidate();
            }} />
          ))}
        </div>
      </Loadable>
    </div>
  );
}
