import { formatInTimeZone } from "date-fns-tz";

// السيرفر (Vercel) شغال بتوقيت UTC، فـ "النهارده" لازم يتحسب بتوقيت مصر — وإلا
// بعد 10 بالليل بتوقيت القاهرة (أو قبل 2/3 الصبح) اليوم هيتحسب غلط.
export const APP_TIME_ZONE = "Africa/Cairo";

/** تاريخ النهارده بتوقيت القاهرة بصيغة yyyy-MM-dd (نفس صيغة أعمدة date في القاعدة). */
export function todayInCairo(now: Date = new Date()): string {
  return formatInTimeZone(now, APP_TIME_ZONE, "yyyy-MM-dd");
}

/** التسجيل الذاتي لحضور القداس مسموح لقداسات آخر أسبوع بس (نفس الشرط في سياسة 0022). */
export const MASS_SELF_REPORT_DAYS = 7;

/** هل تاريخ القداس (yyyy-MM-dd) من النهارده لحد MASS_SELF_REPORT_DAYS يوم فاتوا، بتوقيت القاهرة؟ */
export function canSelfReportMass(massDate: string, now: Date = new Date()): boolean {
  const today = todayInCairo(now);
  const earliest = new Date(`${today}T00:00:00Z`);
  earliest.setUTCDate(earliest.getUTCDate() - MASS_SELF_REPORT_DAYS);
  return massDate <= today && massDate >= earliest.toISOString().slice(0, 10);
}
