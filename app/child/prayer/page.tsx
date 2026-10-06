import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { PrayerList, type PrayerListItem } from "@/components/PrayerList";

export default async function ChildPrayerListPage() {
  const { supabase, user } = await getCurrentProfile();
  if (!user) redirect("/login");

  const [{ data: prayers }, { data: sessionsToday }] = await Promise.all([
    supabase.from("prayer_contents").select("id, title_ar").eq("is_active", true).order("sort_order"),
    supabase
      .from("prayer_sessions")
      .select("prayer_content_id, started_at, completion_level")
      .eq("user_id", user.id)
      .gte("started_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
  ]);

  const completedIds = new Set(
    (sessionsToday ?? []).filter((s) => s.completion_level === "likely_complete").map((s) => s.prayer_content_id)
  );

  const items: PrayerListItem[] = (prayers ?? []).map((p) => ({
    id: p.id,
    title_ar: p.title_ar,
    completedToday: completedIds.has(p.id)
  }));

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-extrabold text-ink mb-1">الصلاة</h1>
      <p className="text-ink-soft text-sm mb-5">اختر الصلاة التي تريد أداءها الآن</p>
      <PrayerList items={items} basePath="/child/prayer" />
    </div>
  );
}
