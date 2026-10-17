import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";

export type AuditParams = {
  /** null = منفّذ غير معروف (محاولة دخول فاشلة، أو سؤال مجهول في صندوق الندوة). */
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
};

/**
 * يسجّل عملية في سجل العمليات (كل حاجة بتتعمل في التطبيق: دخول/خروج، محاولات
 * دخول غلط، حضور، صلاة، مسابقات، إدارة حسابات...). الجدول بيتنضّف تلقائيًا من
 * السجلات الأقدم من 180 يوم (migration 0018).
 * لازم تتنادى من عميل service role (من السيرفر)، لأن جدول audit_log مالوش سياسة
 * RLS تسمح بالإدراج من عميل المستخدم العادي.
 */
export async function logAuditEvent(serviceClient: SupabaseClient, params: AuditParams) {
  const { error } = await serviceClient.from("audit_log").insert({
    actor_id: params.actorId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    details: params.details ?? {}
  });

  if (error) {
    // لا نمنع العملية الأساسية بسبب فشل التسجيل، لكن يجب رصد الخطأ في مراقبة الخادم
    console.error("audit_log insert failed", error);
  }
}

/** اختصار لـ logAuditEvent بعميل service جديد — للاستخدام من أي server action. */
export async function audit(params: AuditParams) {
  await logAuditEvent(createServiceClient(), params);
}
