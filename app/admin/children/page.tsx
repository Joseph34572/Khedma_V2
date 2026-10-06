import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { ChildrenTable } from "@/components/ChildrenTable";
import { toChildRow } from "@/lib/childRow";
import { QuickStats } from "@/components/children/QuickStats";
import { STAGE_LABELS, STAGE_ORDER, type Stage } from "@/lib/roles";

export default async function AdminChildrenPage({
  searchParams
}: {
  searchParams: { stage?: string };
}) {
  const { supabase, user, role } = await getCurrentProfile();
  if (!user || !role) redirect("/login");
  const showConfession = role === "super_admin" || role === "general_secretary";

  const { data: summary } = await supabase.from("child_activity_summary").select("*").order("full_name");
  const activeStage = (searchParams.stage as Stage | undefined) ?? null;
  const filtered = activeStage ? (summary ?? []).filter((r) => r.stage_id === activeStage) : summary ?? [];

  const rows = filtered.map(toChildRow);

  return (
    <div>
      <h1 className="text-xl font-extrabold text-ink mb-4">الأولاد</h1>

      <div className="flex gap-2 mb-4 flex-wrap">
        <StageFilterLink stage={null} active={activeStage} label="الكل" />
        {STAGE_ORDER.map((s) => (
          <StageFilterLink key={s} stage={s} active={activeStage} label={STAGE_LABELS[s]} />
        ))}
      </div>

      <QuickStats rows={rows} />
      <ChildrenTable rows={rows} showConfession={showConfession} basePath="/admin/children" />
    </div>
  );
}

function StageFilterLink({ stage, active, label }: { stage: Stage | null; active: Stage | null; label: string }) {
  const href = stage ? `/admin/children?stage=${stage}` : "/admin/children";
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
