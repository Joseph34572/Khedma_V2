import { z } from "zod";

/**
 * مخططات تحقّق مشتركة يُعاد استخدامها في كل الـ Server Actions بدل تكرار
 * نفس المنطق أو الاكتفاء بتحويل نوع TypeScript (مثل "as AppRole") الذي لا
 * يتحقق من القيمة فعليًا وقت التشغيل. أي قيمة قادمة من العميل (FormData أو
 * استدعاء مباشر) يجب أن تمر من هنا قبل استخدامها.
 */

export const uuidSchema = z.string().uuid({ message: "معرّف غير صحيح." });

export const appRoleSchema = z.enum(["super_admin", "general_secretary", "stage_secretary", "servant", "member"], {
  errorMap: () => ({ message: "نوع المستخدم غير صحيح." })
});

export const stageSchema = z.enum(["prep1", "prep2", "prep3"], {
  errorMap: () => ({ message: "المرحلة غير صحيحة." })
});

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, "الاسم يجب أن يكون حرفين على الأقل.")
  .max(100, "الاسم طويل جدًا.");

/** كلمة المرور الحالية للمشروع: 6 أحرف على الأقل (بدون حد أقصى صارم تعسفي). */
export const passwordSchema = z
  .string()
  .min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل.")
  .max(128, "كلمة المرور طويلة جدًا.");

export const phoneRawSchema = z.string().trim().min(5, "رقم الهاتف غير صحيح.").max(20, "رقم الهاتف غير صحيح.");

/** رابط اختياري يُرفق بإشعار — يمنع javascript:/data: ويسمح فقط بروابط https أو مسارات داخلية نسبية. */
export function safeUrlOrNull(raw: string | null | undefined): { ok: true; value: string | null } | { ok: false; error: string } {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { ok: true, value: null };

  // مسار داخلي نسبي (يبدأ بـ / وليس //) — مسموح بدون فحص بروتوكول
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    if (trimmed.length > 500) return { ok: false, error: "الرابط طويل جدًا." };
    return { ok: true, value: trimmed };
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") {
      return { ok: false, error: "يُسمح فقط بروابط https:// أو مسار داخلي يبدأ بـ /." };
    }
    if (trimmed.length > 2000) return { ok: false, error: "الرابط طويل جدًا." };
    return { ok: true, value: url.toString() };
  } catch {
    return { ok: false, error: "صيغة الرابط غير صحيحة." };
  }
}

export const dateIsoSchema = z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), "تاريخ غير صحيح.");

export const paginationSchema = z.object({
  page: z.number().int().min(1).max(100000).optional().default(1),
  pageSize: z.number().int().min(1).max(200).optional().default(50)
});

/** يحوّل أي خطأ Zod لأول رسالة عربية بشكل آمن للعرض للمستخدم. */
export function firstZodMessage(error: z.ZodError, fallback = "بيانات غير صحيحة."): string {
  return error.issues[0]?.message ?? fallback;
}
