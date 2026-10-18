"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { canViewAllStages, type AppRole, type Stage } from "@/lib/roles";
import { logAuditEvent, audit } from "@/lib/audit";
import { z } from "zod";
import { uuidSchema } from "@/lib/validation";

export type ActionState = { error: string | null; success: string | null };

export async function createMassAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل الدخول", success: null };

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!me || !canViewAllStages(me.role as AppRole)) {
    return { error: "إنشاء قداس متاح للمدير العام والأمين العام فقط", success: null };
  }

  const titleAr = String(formData.get("title_ar") ?? "").trim();
  const massDate = String(formData.get("mass_date") ?? "");
  if (!titleAr || !massDate) return { error: "أكمل كل الحقول.", success: null };

  const { data: mass, error } = await supabase.from("masses").insert({ title_ar: titleAr, mass_date: massDate }).select("id").single();
  if (error) return { error: "تعذّر إنشاء القداس.", success: null };

  // جدول masses مفيهوش عمود created_by، فده المكان الوحيد اللي بيتسجّل فيه مين أنشأ القداس.
  await logAuditEvent(createServiceClient(), { actorId: user.id, action: "create_mass", entityType: "mass", entityId: mass?.id, details: { title_ar: titleAr, mass_date: massDate } });

  revalidatePath("/admin/attendance/mass");
  revalidatePath("/servant/attendance/mass");
  return { error: null, success: "تم إنشاء القداس بنجاح." };
}

export async function createSundaySchoolSessionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل الدخول", success: null };

  const stageId = String(formData.get("stage_id") ?? "");
  const sessionDate = String(formData.get("session_date") ?? "");
  const startsAt = String(formData.get("starts_at") ?? "") || null;
  const endsAt = String(formData.get("ends_at") ?? "") || null;

  if (!stageId || !sessionDate) return { error: "أكمل كل الحقول المطلوبة.", success: null };

  const { data: session, error } = await supabase
    .from("sunday_school_sessions")
    .insert({
      stage_id: stageId as Stage,
      session_date: sessionDate,
      starts_at: startsAt,
      ends_at: endsAt,
      created_by: user.id
    })
    .select("id")
    .single();

  if (error) return { error: "تعذّر إنشاء الجلسة. تأكد أن لديك صلاحية على هذه المرحلة.", success: null };

  await audit({ actorId: user.id, action: "create_sunday_school_session", entityType: "sunday_school_session", entityId: session?.id, details: { stage_id: stageId, session_date: sessionDate } });

  revalidatePath("/admin/attendance/sunday-school");
  revalidatePath("/servant/attendance/sunday-school");
  return { error: null, success: "تم إنشاء جلسة مدارس الأحد بنجاح." };
}

// أكبر كشف حضور معقول في مرة واحدة (مرحلة كاملة). أي عدد أكبر أو معرّفات مش UUID
// يبقى طلب متلاعب بيه، فبنرفضه بدل ما نبعته لقاعدة البيانات ونسجّله كله في السجل.
const MAX_ATTENDANCE_BATCH = 500;
const attendanceIdsSchema = z.array(uuidSchema).max(MAX_ATTENDANCE_BATCH);

function parseAttendanceIds(entityId: unknown, userIds: unknown): { userIds: string[] } | { error: string } {
  if (!uuidSchema.safeParse(entityId).success) return { error: "الجلسة غير موجودة." };
  const parsed = attendanceIdsSchema.safeParse(userIds);
  if (!parsed.success) return { error: "قائمة الحضور غير صحيحة." };
  return { userIds: Array.from(new Set(parsed.data)) };
}

export async function recordMassAttendanceAction(massId: string, userIds: string[]): Promise<{ ok: true; failed: number } | { error: string }> {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل الدخول" };
  const ids = parseAttendanceIds(massId, userIds);
  if ("error" in ids) return ids;
  userIds = ids.userIds;
  if (userIds.length === 0) return { ok: true, failed: 0 };

  const rows = userIds.map((uid) => ({ mass_id: massId, user_id: uid, method: "manual_by_servant" as const, recorded_by: user.id }));
  const { error, count } = await supabase.from("mass_attendance").upsert(rows, { onConflict: "mass_id,user_id", ignoreDuplicates: true, count: "exact" });

  if (error) return { error: "تعذّر حفظ الحضور." };
  await audit({ actorId: user.id, action: "record_mass_attendance", entityType: "mass", entityId: massId, details: { children: userIds.length, user_ids: userIds } });
  revalidatePath("/admin/children");
  revalidatePath("/servant");
  return { ok: true, failed: userIds.length - (count ?? userIds.length) };
}

export async function recordSundaySchoolAttendanceAction(sessionId: string, userIds: string[]): Promise<{ ok: true } | { error: string }> {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل الدخول" };
  const ids = parseAttendanceIds(sessionId, userIds);
  if ("error" in ids) return ids;
  userIds = ids.userIds;
  if (userIds.length === 0) return { ok: true };

  const rows = userIds.map((uid) => ({ session_id: sessionId, user_id: uid, method: "manual_by_servant" as const, recorded_by: user.id }));
  const { error } = await supabase.from("sunday_school_attendance").upsert(rows, { onConflict: "session_id,user_id", ignoreDuplicates: true });

  if (error) return { error: "تعذّر حفظ الحضور." };
  await audit({ actorId: user.id, action: "record_sunday_school_attendance", entityType: "sunday_school_session", entityId: sessionId, details: { children: userIds.length, user_ids: userIds } });
  revalidatePath("/admin/children");
  revalidatePath("/servant");
  return { ok: true };
}

export async function deleteMassAction(massId: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل الدخول" };

  const { data: mass } = await supabase.from("masses").select("title_ar, mass_date").eq("id", massId).maybeSingle();
  const { error, count } = await supabase.from("masses").delete({ count: "exact" }).eq("id", massId);
  if (error) return { error: "تعذّر حذف القداس." };
  if (!count) return { error: "لا تملك صلاحية حذف هذا القداس." };

  await logAuditEvent(createServiceClient(), { actorId: user.id, action: "delete_mass", entityType: "mass", entityId: massId, details: mass ?? {} });

  revalidatePath("/admin/attendance/mass");
  revalidatePath("/servant/attendance/mass");
  return {};
}

export async function deleteSundaySchoolSessionAction(sessionId: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل الدخول" };

  const { data: session } = await supabase.from("sunday_school_sessions").select("stage_id, session_date").eq("id", sessionId).maybeSingle();
  const { error, count } = await supabase.from("sunday_school_sessions").delete({ count: "exact" }).eq("id", sessionId);
  if (error) return { error: "تعذّر حذف الجلسة." };
  if (!count) return { error: "لا تملك صلاحية حذف هذه الجلسة." };

  await logAuditEvent(createServiceClient(), { actorId: user.id, action: "delete_sunday_school_session", entityType: "sunday_school_session", entityId: sessionId, details: session ?? {} });

  revalidatePath("/admin/attendance/sunday-school");
  revalidatePath("/servant/attendance/sunday-school");
  return {};
}
