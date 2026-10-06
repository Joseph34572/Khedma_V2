import type { ChildRow } from "@/lib/childRow";

export function QuickStats({ rows }: { rows: ChildRow[] }) {
  const total = rows.length;
  const prayedToday = rows.filter((r) => r.today_prayer_status === "completed").length;
  const readToday = rows.filter((r) => r.today_reading_status === "completed").length;

  const sevenDaysAgo = Date.now() - 7 * 86_400_000;
  const massLast7 = rows.filter((r) => r.last_mass_date && new Date(r.last_mass_date).getTime() >= sevenDaysAgo).length;

  const lastSundaySchoolDates = rows.map((r) => r.last_sunday_school_date).filter(Boolean) as string[];
  const lastSundaySchoolDate = lastSundaySchoolDates.length
    ? lastSundaySchoolDates.sort((a, b) => (a < b ? 1 : -1))[0]
    : null;
  const lastSundaySchoolCount = lastSundaySchoolDate
    ? rows.filter((r) => r.last_sunday_school_date === lastSundaySchoolDate).length
    : 0;

  const items: { label: string; value: string }[] = [
    { label: "عدد الأولاد", value: String(total) },
    { label: "أتموا الصلاة اليوم", value: String(prayedToday) },
    { label: "قرأوا الكتاب اليوم", value: String(readToday) },
    { label: "حضروا القداس خلال آخر 7 أيام", value: String(massLast7) },
    {
      label: "حضروا مدارس الأحد آخر مرة",
      value: lastSundaySchoolDate
        ? `${lastSundaySchoolCount} بتاريخ ${new Date(lastSundaySchoolDate).toLocaleDateString("ar-EG", { day: "numeric", month: "long" })}`
        : "—"
    }
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
      {items.map((item) => (
        <div key={item.label} className="rounded-card border border-line bg-white p-3.5">
          <p className="text-lg font-extrabold text-primary">{item.value}</p>
          <p className="text-xs text-ink-soft mt-1">{item.label}</p>
        </div>
      ))}
    </div>
  );
}
