import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { Inbox } from "@/components/notifications/Inbox";
import { loadInbox } from "@/components/notifications/InboxQuery";

export default async function ChildNotificationsPage() {
  const { user } = await getCurrentProfile();
  if (!user) redirect("/login");

  const items = await loadInbox();

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-extrabold text-ink mb-1">الإشعارات</h1>
      <p className="text-ink-soft text-sm mb-6">كل الإشعارات الموجّهة لك.</p>
      <Inbox items={items} />
    </div>
  );
}
