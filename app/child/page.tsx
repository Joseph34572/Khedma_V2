import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { relativeArabicDate } from "@/lib/format";

export default async function ChildHomePage() {
  const { supabase, user } = await getCurrentProfile();
  if (!user) redirect("/login");

  const [{ data: lastPrayer }, { data: lastReading }, { data: lastMass }, { data: lastConfession }, { data: lastSunday }] =
    await Promise.all([
      supabase
        .from("prayer_sessions")
        .select("started_at, completion_level")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("bible_reading_sessions")
        .select("started_at, progress_percent")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("mass_attendance")
        .select("created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("confessions")
        .select("confessed_at")
        .eq("user_id", user.id)
        .order("confessed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("sunday_school_attendance")
        .select("recorded_at")
        .eq("user_id", user.id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);

  const today = new Date().toDateString();
  const prayedToday = lastPrayer && new Date(lastPrayer.started_at).toDateString() === today && lastPrayer.completion_level === "likely_complete";

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-extrabold text-ink mb-1">اليوم</h1>
      <p className="text-ink-soft text-sm mb-6">نظرة سريعة على نشاطك الروحي</p>

      <div className="space-y-3">
        <Row label="الصلاة">
          {prayedToday ? <StatusBadge tone="good">✅ مكتملة</StatusBadge> : <StatusBadge tone="warn">🟡 لم تكتمل بعد اليوم</StatusBadge>}
        </Row>
        <Row label="قراءة الكتاب المقدس">
          <span className="font-bold text-ink">{lastReading?.progress_percent ?? 0}%</span>
        </Row>
        <Row label="القداس">
          {lastMass ? (
            <span className="text-ink-soft">{relativeArabicDate(lastMass.created_at)}</span>
          ) : (
            <StatusBadge tone="muted">لم يتم التسجيل</StatusBadge>
          )}
        </Row>
        <Row label="الاعتراف">
          <span className="text-ink-soft">{relativeArabicDate(lastConfession?.confessed_at ?? null)}</span>
        </Row>
        <Row label="مدارس الأحد">
          {lastSunday ? (
            <StatusBadge tone="good">✅ {relativeArabicDate(lastSunday.recorded_at)}</StatusBadge>
          ) : (
            <StatusBadge tone="muted">لم يسجّل بعد</StatusBadge>
          )}
        </Row>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-card border border-line p-4 flex items-center justify-between">
      <span className="font-medium text-ink">{label}</span>
      {children}
    </div>
  );
}
