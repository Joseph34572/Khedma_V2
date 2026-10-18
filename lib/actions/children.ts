"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAuditEvent } from "@/lib/audit";
import { normalizePhone, phoneToAuthEmail } from "@/lib/phone";
import { stageSchema, fullNameSchema, passwordSchema, uuidSchema, firstZodMessage } from "@/lib/validation";
import { ExpectedError, safeErrorMessage } from "@/lib/safeError";

/**
 * إدارة حسابات الأولاد (role = member) للخدام والأمناء — مش بس المدير العام.
 * القواعد (بتتطبّق هنا على السيرفر، مش في الواجهة بس):
 * - الخادم وأمين المرحلة: أولاد مرحلتهم فقط، والولد الجديد بيتسجّل في مرحلتهم تلقائيًا.
 * - الأمين العام والمدير العام: أولاد أي مرحلة، ويقدروا ينقلوا الولد لمرحلة تانية.
 * - الحساب المستهدف لازم يكون ولد (member) — مفيش أي تحكم في حسابات الخدام/الأمناء
 *   من هنا، ومفيش تغيير للدور نفسه. الحذف النهائي فاضل للمدير العام بس.
 * العمليات بتتم بـ service client (لأن RLS مش بيسمح للخادم يعدّل بروفايل غيره)،
 * فالتحقق من الصلاحية هنا هو خط الدفاع، وكل عملية بتتسجّل في سجل العمليات.
 */

export type ChildActionState = { error: string | null; success: string | null };

type Stage = "prep1" | "prep2" | "prep3";
type Manager = { actorId: string; global: boolean; stage: Stage | null };

const MANAGER_ROLES = ["servant", "stage_secretary", "general_secretary", "super_admin"] as const;

async function requireChildManager(): Promise<Manager> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new ExpectedError("غير مسجّل الدخول");

  const { data: me } = await supabase.from("profiles").select("role, stage_id, status").eq("id", user.id).single();
  if (!me || me.status !== "active" || !(MANAGER_ROLES as readonly string[]).includes(me.role)) {
    throw new ExpectedError("ليس لديك صلاحية إدارة حسابات الأولاد.");
  }
  const global = me.role === "super_admin" || me.role === "general_secretary";
  if (!global && !me.stage_id) throw new ExpectedError("حسابك غير مرتبط بمرحلة.");
  return { actorId: user.id, global, stage: (me.stage_id as Stage | null) ?? null };
}

/** يتأكد إن الحساب ده ولد وفي نطاق المسؤول، ويرجّع بياناته الحالية. */
async function loadChildInScope(service: ReturnType<typeof createServiceClient>, mgr: Manager, childId: string) {
  const { data: child } = await service
    .from("profiles")
    .select("id, full_name, role, stage_id, status")
    .eq("id", childId)
    .maybeSingle();
  if (!child || child.role !== "member") throw new ExpectedError("هذا الحساب ليس حساب ولد.");
  if (!mgr.global && child.stage_id !== mgr.stage) throw new ExpectedError("هذا الولد ليس في مرحلتك.");
  return child;
}

function parseStage(mgr: Manager, raw: FormDataEntryValue | null): Stage {
  if (!mgr.global) return mgr.stage as Stage;
  const parsed = stageSchema.safeParse(raw);
  if (!parsed.success) throw new ExpectedError("اختر المرحلة.");
  return parsed.data;
}

function revalidateChildren() {
  revalidatePath("/servant/children");
  revalidatePath("/admin/children");
}

export async function createChildAction(_prev: ChildActionState, formData: FormData): Promise<ChildActionState> {
  try {
    const mgr = await requireChildManager();

    const nameParsed = fullNameSchema.safeParse(formData.get("full_name"));
    if (!nameParsed.success) return { error: firstZodMessage(nameParsed.error), success: null };
    const fullName = nameParsed.data;

    const normalized = normalizePhone(String(formData.get("phone") ?? ""));
    if (!normalized) return { error: "رقم الهاتف غير صحيح.", success: null };

    const passwordParsed = passwordSchema.safeParse(formData.get("password"));
    if (!passwordParsed.success) return { error: firstZodMessage(passwordParsed.error), success: null };

    const stage = parseStage(mgr, formData.get("stage_id"));
    const service = createServiceClient();

    const { data: created, error: createError } = await service.auth.admin.createUser({
      email: phoneToAuthEmail(normalized),
      password: passwordParsed.data,
      email_confirm: true
    });
    if (createError || !created.user) {
      if (createError?.message?.toLowerCase().includes("already")) {
        return { error: "رقم الهاتف مستخدم بالفعل لحساب آخر.", success: null };
      }
      return { error: "تعذّر إنشاء الحساب. حاول مرة أخرى.", success: null };
    }

    const { error: profileError } = await service.from("profiles").insert({
      id: created.user.id,
      full_name: fullName,
      phone_normalized: normalized,
      role: "member",
      stage_id: stage,
      created_by: mgr.actorId
    });
    if (profileError) {
      await service.auth.admin.deleteUser(created.user.id);
      return { error: "تعذّر حفظ بيانات الولد. حاول مرة أخرى.", success: null };
    }

    await logAuditEvent(service, {
      actorId: mgr.actorId,
      action: "create_child",
      entityType: "profile",
      entityId: created.user.id,
      details: { full_name: fullName, stage_id: stage }
    });

    revalidateChildren();
    return { error: null, success: `تم إنشاء حساب ${fullName} بنجاح.` };
  } catch (e) {
    return { error: safeErrorMessage(e, "createChildAction"), success: null };
  }
}

export async function updateChildAction(_prev: ChildActionState, formData: FormData): Promise<ChildActionState> {
  try {
    const mgr = await requireChildManager();
    const idParsed = uuidSchema.safeParse(formData.get("child_id"));
    if (!idParsed.success) return { error: "بيانات غير مكتملة.", success: null };

    const nameParsed = fullNameSchema.safeParse(formData.get("full_name"));
    if (!nameParsed.success) return { error: firstZodMessage(nameParsed.error), success: null };

    const service = createServiceClient();
    const before = await loadChildInScope(service, mgr, idParsed.data);
    // خادم/أمين المرحلة مش بيقدر ينقل الولد لمرحلة تانية — المرحلة بتفضل زي ما هي.
    const stage = mgr.global ? parseStage(mgr, formData.get("stage_id")) : (before.stage_id as Stage);

    const { error } = await service
      .from("profiles")
      .update({ full_name: nameParsed.data, stage_id: stage })
      .eq("id", before.id)
      .eq("role", "member");
    if (error) return { error: "تعذّر تحديث بيانات الولد.", success: null };

    await logAuditEvent(service, {
      actorId: mgr.actorId,
      action: "update_child",
      entityType: "profile",
      entityId: before.id,
      details: {
        before: { full_name: before.full_name, stage_id: before.stage_id },
        after: { full_name: nameParsed.data, stage_id: stage }
      }
    });

    revalidateChildren();
    return { error: null, success: "تم حفظ التعديلات." };
  } catch (e) {
    return { error: safeErrorMessage(e, "updateChildAction"), success: null };
  }
}

export async function setChildStatusAction(childId: string, status: "active" | "disabled"): Promise<{ error?: string }> {
  try {
    const mgr = await requireChildManager();
    const idParsed = uuidSchema.safeParse(childId);
    if (!idParsed.success) return { error: "معرّف غير صحيح." };
    if (status !== "active" && status !== "disabled") return { error: "حالة غير صحيحة." };

    const service = createServiceClient();
    const child = await loadChildInScope(service, mgr, idParsed.data);

    const { error } = await service.from("profiles").update({ status }).eq("id", child.id).eq("role", "member");
    if (error) return { error: "تعذّر تنفيذ العملية." };

    // نفس أسلوب إدارة المستخدمين: الحظر بيمنع تجديد الجلسة أو الدخول من جديد.
    const { error: banError } = await service.auth.admin.updateUserById(child.id, {
      ban_duration: status === "disabled" ? "87600h" : "none"
    });
    if (banError) console.error("setChildStatusAction: ban_duration update failed", { error: banError.message });

    await logAuditEvent(service, {
      actorId: mgr.actorId,
      action: status === "disabled" ? "disable_child" : "enable_child",
      entityType: "profile",
      entityId: child.id,
      details: { full_name: child.full_name }
    });

    revalidateChildren();
    return {};
  } catch (e) {
    return { error: safeErrorMessage(e, "setChildStatusAction") };
  }
}

export async function resetChildPasswordAction(_prev: ChildActionState, formData: FormData): Promise<ChildActionState> {
  try {
    const mgr = await requireChildManager();
    const idParsed = uuidSchema.safeParse(formData.get("child_id"));
    if (!idParsed.success) return { error: "بيانات غير مكتملة.", success: null };

    const passwordParsed = passwordSchema.safeParse(formData.get("password"));
    if (!passwordParsed.success) return { error: firstZodMessage(passwordParsed.error), success: null };

    const service = createServiceClient();
    const child = await loadChildInScope(service, mgr, idParsed.data);

    const { error } = await service.auth.admin.updateUserById(child.id, { password: passwordParsed.data });
    if (error) return { error: "تعذّر تغيير كلمة المرور.", success: null };

    await logAuditEvent(service, {
      actorId: mgr.actorId,
      action: "reset_child_password",
      entityType: "profile",
      entityId: child.id,
      details: { full_name: child.full_name }
    });

    return { error: null, success: "تم تغيير كلمة المرور." };
  } catch (e) {
    return { error: safeErrorMessage(e, "resetChildPasswordAction"), success: null };
  }
}
