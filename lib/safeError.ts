/**
 * خطأ "متوقَّع" برسالة عربية آمنة يجوز عرضها للمستخدم مباشرة (مثل "هذه العملية
 * متاحة للمدير العام فقط"). أي خطأ آخر (استثناء غير متوقع من الشبكة أو قاعدة
 * البيانات) يُسجَّل في سجلات الخادم فقط، ويُعرض للمستخدم رسالة عامة بدل كشف
 * تفاصيل داخلية (رسائل Postgres/Supabase، مسارات، إلخ).
 */
export class ExpectedError extends Error {}

/** يبني رسالة آمنة من أي خطأ: يُسجّل التفاصيل التقنية في سجل الخادم فقط. */
export function safeErrorMessage(error: unknown, context: string, fallback = "حدث خطأ غير متوقع. حاول مرة أخرى."): string {
  if (error instanceof ExpectedError) return error.message;

  console.error(`${context} failed`, {
    error: error instanceof Error ? error.message : "Unknown error"
  });
  return fallback;
}
