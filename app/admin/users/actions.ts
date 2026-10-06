"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAuditEvent } from "@/lib/audit";
import { normalizePhone, phoneToAuthEmail } from "@/lib/phone";
import type { AppRole, Stage } from "@/lib/roles";

export type ActionState = { error: string | null; success: string | null };

async function requireSuperAdmin() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("غير مسجّل الدخول");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "super_admin") {
    throw new Error("هذه العملية متاحة للمدير العام فقط");
  }
  return { supabase, actorId: user.id };
}

export async function createUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { actorId } = await requireSuperAdmin();

    const fullName = String(formData.get("full_name") ?? "").trim();
    const phoneRaw = String(formData.get("phone") ?? "");
    const password = String(formData.get("password") ?? "");
    const role = String(formData.get("role") ?? "member") as AppRole;
    const stage = (String(formData.get("stage_id") ?? "") || null) as Stage | null;

    if (!fullName) return { error: "اسم المستخدم مطلوب.", success: null };
    const normalized = normalizePhone(phoneRaw);
    if (!normalized) return { error: "رقم الهاتف غير صحيح.", success: null };
    if (password.length < 6) return { error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل.", success: null };
    if (role !== "super_admin" && role !== "general_secretary" && !stage) {
      return { error: "يجب تحديد مرحلة لهذا النوع من المستخدمين.", success: null };
    }

    const serviceClient = createServiceClient();

    const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
      email: phoneToAuthEmail(normalized),
      password,
      email_confirm: true
    });

    if (createError || !created.user) {
      if (createError?.message?.toLowerCase().includes("already")) {
        return { error: "رقم الهاتف مستخدم بالفعل لحساب آخر.", success: null };
      }
      return { error: "تعذّر إنشاء الحساب. حاول مرة أخرى.", success: null };
    }

    const { error: profileError } = await serviceClient.from("profiles").insert({
      id: created.user.id,
      full_name: fullName,
      phone_normalized: normalized,
      role,
      stage_id: stage,
      created_by: actorId
    });

    if (profileError) {
      await serviceClient.auth.admin.deleteUser(created.user.id);
      return { error: "تعذّر حفظ بيانات المستخدم. حاول مرة أخرى.", success: null };
    }

    await logAuditEvent(serviceClient, {
      actorId,
      action: "create_user",
      entityType: "profile",
      entityId: created.user.id,
      details: { full_name: fullName, role, stage_id: stage }
    });

    revalidatePath("/admin/users");
    return { error: null, success: `تم إنشاء حساب ${fullName} بنجاح.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "حدث خطأ غير متوقع.", success: null };
  }
}

export async function updateUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { actorId } = await requireSuperAdmin();
    const serviceClient = createServiceClient();

    const userId = String(formData.get("user_id") ?? "");
    const fullName = String(formData.get("full_name") ?? "").trim();
    const role = String(formData.get("role") ?? "") as AppRole;
    const stage = (String(formData.get("stage_id") ?? "") || null) as Stage | null;

    if (!userId || !fullName) return { error: "بيانات غير مكتملة.", success: null };
    if (role !== "super_admin" && role !== "general_secretary" && !stage) {
      return { error: "يجب تحديد مرحلة لهذا النوع من المستخدمين.", success: null };
    }

    const { data: before } = await serviceClient.from("profiles").select("role, stage_id, full_name").eq("id", userId).single();

    const { error } = await serviceClient
      .from("profiles")
      .update({ full_name: fullName, role, stage_id: role === "super_admin" || role === "general_secretary" ? null : stage })
      .eq("id", userId);

    if (error) return { error: "تعذّر تحديث بيانات المستخدم.", success: null };

    await logAuditEvent(serviceClient, {
      actorId,
      action: "update_user",
      entityType: "profile",
      entityId: userId,
      details: { before, after: { full_name: fullName, role, stage_id: stage } }
    });

    revalidatePath("/admin/users");
    return { error: null, success: "تم تحديث بيانات المستخدم." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "حدث خطأ غير متوقع.", success: null };
  }
}

export async function setUserStatusAction(userId: string, status: "active" | "disabled") {
  const { actorId } = await requireSuperAdmin();
  const serviceClient = createServiceClient();

  const { error } = await serviceClient.from("profiles").update({ status }).eq("id", userId);
  if (error) throw new Error("تعذّر تنفيذ العملية.");

  await logAuditEvent(serviceClient, {
    actorId,
    action: status === "disabled" ? "disable_user" : "enable_user",
    entityType: "profile",
    entityId: userId
  });

  revalidatePath("/admin/users");
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { actorId } = await requireSuperAdmin();
    const serviceClient = createServiceClient();

    const userId = String(formData.get("user_id") ?? "");
    const password = String(formData.get("password") ?? "");
    if (password.length < 6) return { error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل.", success: null };

    const { error } = await serviceClient.auth.admin.updateUserById(userId, { password });
    if (error) return { error: "تعذّر تغيير كلمة المرور.", success: null };

    await logAuditEvent(serviceClient, {
      actorId,
      action: "reset_password",
      entityType: "profile",
      entityId: userId
    });

    return { error: null, success: "تم تغيير كلمة المرور بنجاح." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "حدث خطأ غير متوقع.", success: null };
  }
}
