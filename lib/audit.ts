import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * يسجّل عملية إدارية حساسة في سجل العمليات.
 * يجب استدعاؤها فقط من عميل يملك صلاحية service role (من الخادم)، لأن جدول
 * audit_log لا يملك سياسة RLS تسمح بالإدراج من عميل المستخدم العادي.
 */
export async function logAuditEvent(
  serviceClient: SupabaseClient,
  params: {
    actorId: string;
    action: string;
    entityType: string;
    entityId?: string;
    details?: Record<string, unknown>;
  }
) {
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
