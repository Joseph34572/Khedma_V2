import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { ComposeForm } from "@/components/notifications/ComposeForm";
import { Inbox } from "@/components/notifications/Inbox";
import { loadInbox } from "@/components/notifications/InboxQuery";

export default async function ServantNotificationsPage() {
  const { user, role, stageId } = await getCurrentProfile();
  if (!user || !role) redirect("/login");

  const items = await loadInbox();
  const canCompose = role === "stage_secretary";

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-extrabold text-ink mb-1">الإشعارات</h1>
      <p className="text-ink-soft text-sm mb-6">
        {canCompose ? "إرسال إشعارات لأولاد أو خدام مرحلتك، ومتابعة صندوق الوارد." : "صندوق الوارد الخاص بك."}
      </p>

      {canCompose && <ComposeForm scope="stage" myStage={stageId} />}

      <h2 className="font-bold text-ink mb-3">صندوق الوارد</h2>
      <Inbox items={items} />
    </div>
  );
}
