import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { STAGE_LABELS, STAGE_ORDER, canViewAllStages } from "@/lib/roles";

export default async function AdminDashboardPage() {
  const { supabase, user, role, stageId } = await getCurrentProfile();
  if (!user) redirect("/login");
  if (!role) redirect("/login");

  const globalView = canViewAllStages(role);
  const stagesToShow = globalView ? STAGE_ORDER : stageId ? [stageId] : [];

  // إحصائيات عامة (تحترمها سياسات RLS تلقائيًا حسب نطاق المستخدم)
  const [{ count: totalKids }, { count: totalServants }, { data: summary }] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "member").eq("status", "active"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "servant").eq("status", "active"),
    supabase.from("child_activity_summary").select("*")
  ]);

  const rows = summary ?? [];
  const today = new Date().toDateString();
  const prayedToday = rows.filter((r) => r.last_prayer_at && new Date(r.last_prayer_at).toDateString() === today).length;
  const readToday = rows.filter((r) => r.last_reading_at && new Date(r.last_reading_at).toDateString() === today).length;

  const sevenDaysAgo = Date.now() - 7 * 86_400_000;
  const massLast7 = rows.filter((r) => r.last_mass_date && new Date(r.last_mass_date).getTime() >= sevenDaysAgo).length;

  return (
    <div>
      <h1 className="text-xl font-extrabold text-ink mb-1">لوحة المتابعة</h1>
      <p className="text-ink-soft text-sm mb-6">نظرة عامة على نشاط الخدمة</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <Link href="/admin/children" className="block">
          <StatCard label="إجمالي الأولاد" value={totalKids ?? 0} />
        </Link>
        <Link href="/admin/servants" className="block">
          <StatCard label="إجمالي الخدام" value={totalServants ?? 0} />
        </Link>
        <StatCard label="صلّوا اليوم" value={prayedToday} />
        <StatCard label="قرأوا الكتاب اليوم" value={readToday} />
        <StatCard label="حضروا القداس آخر 7 أيام" value={massLast7} />
      </div>

      <h2 className="font-bold text-ink mb-3">المراحل</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {stagesToShow.map((stageId) => {
          const stageRows = rows.filter((r) => r.stage_id === stageId);
          const count = stageRows.length;
          const prayerPct = count ? Math.round((stageRows.filter((r) => r.last_prayer_at && new Date(r.last_prayer_at).toDateString() === today).length / count) * 100) : 0;
          const readPct = count ? Math.round((stageRows.filter((r) => r.last_reading_at && new Date(r.last_reading_at).toDateString() === today).length / count) * 100) : 0;

          return (
            <Link
              key={stageId}
              href={`/admin/children?stage=${stageId}`}
              className="rounded-card border border-line bg-white p-4 hover:border-primary transition-colors"
            >
              <p className="font-bold text-ink">{STAGE_LABELS[stageId]}</p>
              <p className="text-ink-soft text-sm mt-1">{count} ولد</p>
              <div className="mt-3 space-y-1 text-sm">
                <p>نسبة الصلاة اليوم: <span className="font-bold text-primary">{prayerPct}%</span></p>
                <p>نسبة القراءة اليوم: <span className="font-bold text-primary">{readPct}%</span></p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card border border-line bg-white p-4">
      <p className="text-2xl font-extrabold text-primary">{value}</p>
      <p className="text-xs text-ink-soft mt-1">{label}</p>
    </div>
  );
}
