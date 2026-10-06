"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ScanResult = { ok: true; name: string } | { error: string; duplicate?: boolean };

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

/** يسجّل حضور ولد بمسح رمزه. التحقق من الصلاحية والمرحلة يتم على الخادم وقاعدة البيانات (RLS). */
export async function scanAttendanceAction(kind: "mass" | "sunday_school", entityId: string, rawCode: string): Promise<ScanResult> {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل الدخول" };

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!me || me.role === "member") return { error: "غير مصرح لك بتسجيل الحضور" };

  if (!rawCode.startsWith("khedma:")) return { error: "هذا الرمز ليس رمز حضور من التطبيق" };
  const token = rawCode.slice(7);
  if (!TOKEN_RE.test(token)) return { error: "الرمز غير صالح" };

  // الاستعلام يمر عبر RLS: لن يجد الخادم ولدًا من خارج نطاقه
  const { data: child } = await supabase
    .from("profiles")
    .select("id, full_name, role, stage_id, status")
    .eq("qr_token", token)
    .maybeSingle();

  if (!child) return { error: "لم يتم العثور على الولد، أو أنه ليس ضمن مرحلتك" };
  if (child.role !== "member") return { error: "هذا الرمز ليس لولد" };
  if (child.status !== "active") return { error: "حساب هذا الولد معطّل" };

  if (kind === "sunday_school") {
    const { data: session } = await supabase.from("sunday_school_sessions").select("stage_id").eq("id", entityId).single();
    if (!session) return { error: "جلسة مدارس الأحد غير موجودة" };
    if (session.stage_id !== child.stage_id) return { error: "هذا الولد ليس من مرحلة هذه الجلسة" };

    const { error } = await supabase
      .from("sunday_school_attendance")
      .insert({ session_id: entityId, user_id: child.id, method: "qr_scan", recorded_by: user.id });
    if (error) {
      if (error.code === "23505") return { error: `${child.full_name}: تم تسجيل حضوره من قبل`, duplicate: true };
      return { error: "تعذّر تسجيل الحضور" };
    }
  } else {
    const { error } = await supabase
      .from("mass_attendance")
      .insert({ mass_id: entityId, user_id: child.id, method: "qr_scan", recorded_by: user.id });
    if (error) {
      if (error.code === "23505") return { error: `${child.full_name}: تم تسجيل حضوره من قبل`, duplicate: true };
      return { error: "تعذّر تسجيل الحضور" };
    }
  }

  revalidatePath("/servant");
  revalidatePath("/admin/children");
  return { ok: true, name: child.full_name };
}
