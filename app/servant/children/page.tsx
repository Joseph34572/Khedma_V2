import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { ChildrenTable } from "@/components/ChildrenTable";
import { toChildRow } from "@/lib/childRow";
import { QuickStats } from "@/components/children/QuickStats";
import { STAGE_LABELS, type Stage } from "@/lib/roles";

export default async function ServantChildrenPage() {
  const { supabase, user, role, stageId } = await getCurrentProfile();
  if (!user || !role) redirect("/login");
  const showConfession = role === "super_admin" || role === "general_secretary";

  const { data: summary, error } = await supabase
    .from("child_activity_summary")
    .select("*")
    .order("full_name", { ascending: true });

  const rows = (summary ?? []).map(toChildRow);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-extrabold text-ink">أولاد {stageId ? STAGE_LABELS[stageId as Stage] : ""}</h1>
        <p className="text-ink-soft text-sm mt-1">جدول المتابعة الأساسي — اضغط على اسم الولد لفتح ملفه الكامل.</p>
      </div>

      <QuickStats rows={rows} />

      {error ? (
        <p className="text-bad">تعذّر تحميل بيانات الأولاد حاليًا.</p>
      ) : (
        <ChildrenTable rows={rows} showConfession={showConfession} basePath="/servant/children" />
      )}
    </div>
  );
}
