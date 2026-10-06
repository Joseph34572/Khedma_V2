import { getCurrentProfile } from "@/lib/auth";
import { redirect } from "next/navigation";

export type InboxItem = {
  recipientId: string;
  title: string;
  body: string;
  linkUrl: string | null;
  sentAt: string | null;
  readAt: string | null;
};

export async function loadInbox(): Promise<InboxItem[]> {
  const { supabase, user } = await getCurrentProfile();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("notification_recipients")
    .select("id, read_at, notifications(title, body, link_url, sent_at)")
    .eq("user_id", user.id)
    .order("id", { ascending: false })
    .limit(50);

  return (data ?? [])
    .filter((r) => r.notifications)
    .map((r) => ({
      recipientId: r.id,
      title: (r.notifications as unknown as { title: string }).title,
      body: (r.notifications as unknown as { body: string }).body,
      linkUrl: (r.notifications as unknown as { link_url: string | null }).link_url,
      sentAt: (r.notifications as unknown as { sent_at: string | null }).sent_at,
      readAt: r.read_at
    }))
    .sort((a, b) => (a.sentAt && b.sentAt ? (a.sentAt < b.sentAt ? 1 : -1) : 0));
}
