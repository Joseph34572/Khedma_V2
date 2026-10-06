import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { relativeArabicDate } from "@/lib/format";
import { MassRow } from "./MassRow";

export default async function ChildMassPage() {
  const { supabase, user } = await getCurrentProfile();
  if (!user) redirect("/login");

  const [{ data: masses }, { data: attendance }] = await Promise.all([
    supabase.from("masses").select("id, title_ar, mass_date").order("mass_date", { ascending: false }).limit(20),
    supabase.from("mass_attendance").select("mass_id").eq("user_id", user.id)
  ]);

  const attendedIds = new Set((attendance ?? []).map((a) => a.mass_id));

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-extrabold text-ink mb-1">تسجيل حضور القداس</h1>
      <p className="text-ink-soft text-sm mb-6">اختر القداس الذي حضرته وسجّل حضورك</p>

      <div className="space-y-2">
        {(masses ?? []).map((mass) => (
          <MassRow
            key={mass.id}
            massId={mass.id}
            title={mass.title_ar}
            dateLabel={relativeArabicDate(mass.mass_date)}
            alreadyAttended={attendedIds.has(mass.id)}
          />
        ))}
        {(!masses || masses.length === 0) && (
          <p className="text-ink-soft text-center py-8">لا توجد قداسات مضافة بعد.</p>
        )}
      </div>
    </div>
  );
}
