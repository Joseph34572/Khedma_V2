import { STAGE_ORDER, type Stage } from "@/lib/roles";

/** كل قيمة من هذه القائمة تمثّل مربّع اختيار واحد في نموذج إرسال الإشعار.
 * هذا الملف عادي (بدون "use server" أو "use client") لأنه يُستورد من كود
 * خادم ("use server") وكود عميل ("use client") في آن واحد: أي دالة غير async
 * تُصدَّر من ملف "use server" تسبب خطأ بناء Next.js ("Server actions must be
 * async functions")، فلازم تفضل الدوال المساعدة البسيطة في ملف منفصل زي ده. */
export type AudienceSegment =
  | "all"
  | `member:${Stage}`
  | `servant:${Stage}`
  | `stage_secretary:${Stage}`
  | "general_secretary"
  | "super_admin";

/** المجموعات المتاحة لمدير عام/أمين عام (يرون كل المراحل والأدوار). */
export function globalAudienceSegments(): AudienceSegment[] {
  const segments: AudienceSegment[] = ["all"];
  for (const stage of STAGE_ORDER) {
    segments.push(`member:${stage}`, `servant:${stage}`, `stage_secretary:${stage}`);
  }
  segments.push("general_secretary", "super_admin");
  return segments;
}

/** المجموعات المتاحة لأمين خدمة: أولاد وخدام مرحلته فقط. */
export function stageAudienceSegments(stage: Stage): AudienceSegment[] {
  return [`member:${stage}`, `servant:${stage}`];
}
