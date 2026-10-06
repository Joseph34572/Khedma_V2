import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { AppRole, Stage } from "@/lib/roles";

/**
 * يجلب المستخدم الحالي وملفه الشخصي مرة واحدة فقط لكل طلب (Request)، بفضل
 * React cache(). الـ layout والصفحة نفسها كانا يستعلمان عن نفس البيانات بشكل
 * منفصل في كل مرة، فكانا يضاعفان عدد نداءات Supabase على كل صفحة؛ هذا الملف
 * هو مصدر الحقيقة الوحيد الذي يُعاد استخدامه بدل إعادة الاستعلام (يحسّن سرعة
 * التطبيق بشكل ملحوظ خصوصًا في الصفحات ذات التخطيط المتداخل).
 */
export const getCurrentProfile = cache(async () => {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, fullName: null, role: null, stageId: null, status: null } as const;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, stage_id, status")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { supabase, user, fullName: null, role: null, stageId: null, status: null } as const;
  }

  return {
    supabase,
    user,
    fullName: profile.full_name as string,
    role: profile.role as AppRole,
    stageId: profile.stage_id as Stage | null,
    status: profile.status as "active" | "disabled"
  } as const;
});
