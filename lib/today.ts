import { formatInTimeZone } from "date-fns-tz";

// السيرفر (Vercel) شغال بتوقيت UTC، فـ "النهارده" لازم يتحسب بتوقيت مصر — وإلا
// بعد 10 بالليل بتوقيت القاهرة (أو قبل 2/3 الصبح) اليوم هيتحسب غلط.
export const APP_TIME_ZONE = "Africa/Cairo";

/** تاريخ النهارده بتوقيت القاهرة بصيغة yyyy-MM-dd (نفس صيغة أعمدة date في القاعدة). */
export function todayInCairo(now: Date = new Date()): string {
  return formatInTimeZone(now, APP_TIME_ZONE, "yyyy-MM-dd");
}
