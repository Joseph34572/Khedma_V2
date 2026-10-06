import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { ChildrenTable, type ChildRow } from "@/components/ChildrenTable";
import { STAGE_LABELS, STAGE_ORDER, canViewAllStages, type Stage } from "@/lib/roles";

export default async function AdminServantsPage({
  searchParams
}: {
  searchParams: { stage?: string };
}) {
  const { supabase, user, role, stageId } = await getCurrentProfile();
  if (!user || !role) redirect("/login");
  const showConfession = role === "super_admin" || role === "general_secretary";
  const globalView = canViewAllStages(role);

  const { data: summary } = await supabase.from("servant_activity_summary").select("*").order("full_name");
  const activeStage = (searchParams.stage as Stage | undefined) ?? null;
  const filtered = activeStage ? (summary ?? []).filter((r) => r.stage_id === activeStage) : summary ?? [];

  const rows: ChildRow[] = filtered.map((r) => ({
    user_id: r.user_id,
    full_name: r.full_name,
    last_prayer_at: r.last_prayer_at,
    last_prayer_activity_at: r.last_prayer_at,
    today_prayer_status: "none",
    last_reading_at: r.last_reading_at,
    last_reading_activity_at: r.last_reading_at,
    today_reading_status: "none",
    last_mass_date: r.last_mass_date,
    last_confession_at: r.last_confession_at,
    last_sunday_school_date: r.last_sunday_school_date,
    weekly_activity_percent: r.weekly_activity_percent,
    monthly_activity_percent: r.weekly_activity_percent
  }));

  return (
    <div>
      <h1 className="text-xl font-extrabold text-ink mb-1">الخدام</h1>
      <p className="text-ink-soft text-sm mb-4">
        {globalView ? "كل الخدام في كل المراحل" : `خدام مرحلة ${stageId ? STAGE_LABELS[stageId as Stage] : ""}`}
      </p>

      {globalView && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <StageFilterLink stage={null} active={activeStage} label="الكل" />
          {STAGE_ORDER.map((s) => (
            <StageFilterLink key={s} stage={s} active={activeStage} label={STAGE_LABELS[s]} />
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="bg-white rounded-card border border-line p-8 text-center text-ink-soft">
          لا يوجد خدام مسجّلون في هذا النطاق بعد.
        </div>
      ) : (
        <ChildrenTable rows={rows} showConfession={showConfession} basePath="/admin/servants" />
      )}
    </div>
  );
}

function StageFilterLink({ stage, active, label }: { stage: Stage | null; active: Stage | null; label: string }) {
  const href = stage ? `/admin/servants?stage=${stage}` : "/admin/servants";
  const isActive = stage === active;
  return (
    <a
      href={href}
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium border ${
        isActive ? "bg-primary text-white border-primary" : "border-line text-ink-soft hover:border-primary"
      }`}
    >
      {label}
    </a>
  );
}
