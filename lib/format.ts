const RTL_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

/** يحوّل تاريخًا إلى نص عربي نسبي مختصر: اليوم / أمس / تاريخ محدد */
export function relativeArabicDate(value: string | null): string {
  if (!value) return "لم يسجل";
  const date = new Date(value);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round(
    (startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000
  );

  if (diffDays === 0) return "اليوم";
  if (diffDays === 1) return "أمس";
  if (diffDays > 1 && diffDays <= 6) return `منذ ${diffDays} أيام`;

  return date.toLocaleDateString("ar-EG", { day: "numeric", month: "long" });
}

export function daysSince(value: string | null): number | null {
  if (!value) return null;
  const diff = Date.now() - new Date(value).getTime();
  return Math.floor(diff / 86_400_000);
}
