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

// كلمات مرور بتتخمّن في أول ثواني من أي هجوم تخمين — ممنوعة حتى لو طولها كفاية.
const COMMON_PASSWORDS = new Set([
  "12345678", "123456789", "1234567890", "87654321", "11223344", "12341234", "00000000",
  "password", "password1", "qwertyui", "qwerty123", "iloveyou", "abcd1234", "abc12345",
  "a1234567", "1q2w3e4r", "asdfghjk", "11111111", "12121212", "123123123", "jesus123"
]);

function isTrivialPassword(pw: string): boolean {
  const lower = pw.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return true;
  if (/^(.)\1+$/.test(pw)) return true; // نفس الحرف مكرر
  // أرقام متتالية صاعدة أو نازلة (23456789، 98765432)
  if (/^\d+$/.test(pw)) {
    const d = pw.split("").map(Number);
    const step = d[1]! - d[0]!;
    if (Math.abs(step) === 1 && d.every((x, i) => i === 0 || x - d[i - 1]! === step)) return true;
  }
  return false;
}

/** كلمة المرور: 8 أحرف على الأقل، ومش من كلمات المرور المشهورة السهلة. */
export const passwordSchema = z
  .string()
  .min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل.")
  .max(128, "كلمة المرور طويلة جدًا.")
  .refine((pw) => !isTrivialPassword(pw), "كلمة المرور دي سهلة التخمين جدًا، اختار واحدة تانية.");

export const phoneRawSchema = z.string().trim().min(5, "رقم الهاتف غير صحيح.").max(20, "رقم الهاتف غير صحيح.");

// مواقع معروفة مسموح بيها في روابط الإشعارات. أي رابط خارجي تاني ممكن يتستخدم في
// تصيّد (صفحة شبه الموقع بتطلب كلمة السر من الأولاد)، فبنقفله.
export const NOTIFICATION_LINK_HOSTS = [
  "youtube.com",
  "youtu.be",
  "st-takla.org",
  "drive.google.com",
  "docs.google.com",
  "forms.gle",
  "facebook.com",
  "fb.watch"
];

function isAllowedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return NOTIFICATION_LINK_HOSTS.some((allowed) => h === allowed || h.endsWith("." + allowed));
}

/** رابط اختياري يُرفق بإشعار — مسار داخلي في التطبيق، أو https لموقع من القائمة المسموحة بس. */
export function safeUrlOrNull(raw: string | null | undefined): { ok: true; value: string | null } | { ok: false; error: string } {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { ok: true, value: null };

  // مسار داخلي نسبي (يبدأ بـ / وليس // ولا /\ اللي بعض المتصفحات بتعتبرها دومين تاني)
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.startsWith("/\\")) {
    if (trimmed.length > 500) return { ok: false, error: "الرابط طويل جدًا." };
    return { ok: true, value: trimmed };
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") {
      return { ok: false, error: "يُسمح فقط بروابط https:// أو مسار داخلي يبدأ بـ /." };
    }
    if (url.username || url.password) return { ok: false, error: "صيغة الرابط غير صحيحة." };
    if (!isAllowedHost(url.hostname)) {
      return { ok: false, error: `الروابط الخارجية مسموحة لمواقع معيّنة بس: ${NOTIFICATION_LINK_HOSTS.join("، ")}.` };
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
