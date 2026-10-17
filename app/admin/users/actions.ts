"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAuditEvent } from "@/lib/audit";
import { normalizePhone, phoneToAuthEmail, formatPhoneForDisplay } from "@/lib/phone";
import { appRoleSchema, stageSchema, fullNameSchema, passwordSchema, uuidSchema, firstZodMessage } from "@/lib/validation";
import { ExpectedError, safeErrorMessage } from "@/lib/safeError";

export type ActionState = { error: string | null; success: string | null };

async function requireSuperAdmin() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new ExpectedError("غير مسجّل الدخول");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "super_admin") {
    throw new ExpectedError("هذه العملية متاحة للمدير العام فقط");
  }
  return { supabase, actorId: user.id };
}

export async function createUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { actorId } = await requireSuperAdmin();

    const nameParsed = fullNameSchema.safeParse(formData.get("full_name"));
    if (!nameParsed.success) return { error: firstZodMessage(nameParsed.error), success: null };
    const fullName = nameParsed.data;

    const phoneRaw = String(formData.get("phone") ?? "");
    const normalized = normalizePhone(phoneRaw);
    if (!normalized) return { error: "رقم الهاتف غير صحيح.", success: null };

    const passwordParsed = passwordSchema.safeParse(formData.get("password"));
    if (!passwordParsed.success) return { error: firstZodMessage(passwordParsed.error), success: null };
    const password = passwordParsed.data;

    const roleParsed = appRoleSchema.safeParse(formData.get("role") || "member");
    if (!roleParsed.success) return { error: firstZodMessage(roleParsed.error), success: null };
    const role = roleParsed.data;

    const stageRaw = String(formData.get("stage_id") ?? "");
    let stage: "prep1" | "prep2" | "prep3" | null = null;
    if (stageRaw) {
      const stageParsed = stageSchema.safeParse(stageRaw);
      if (!stageParsed.success) return { error: firstZodMessage(stageParsed.error), success: null };
      stage = stageParsed.data;
    }
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
    return { error: safeErrorMessage(e, "createUserAction"), success: null };
  }
}

export async function updateUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { actorId } = await requireSuperAdmin();
    const serviceClient = createServiceClient();

    const userIdParsed = uuidSchema.safeParse(formData.get("user_id"));
    if (!userIdParsed.success) return { error: "بيانات غير مكتملة.", success: null };
    const userId = userIdParsed.data;

    const nameParsed = fullNameSchema.safeParse(formData.get("full_name"));
    if (!nameParsed.success) return { error: firstZodMessage(nameParsed.error), success: null };
    const fullName = nameParsed.data;

    const roleParsed = appRoleSchema.safeParse(formData.get("role"));
    if (!roleParsed.success) return { error: firstZodMessage(roleParsed.error), success: null };
    const role = roleParsed.data;

    const stageRaw = String(formData.get("stage_id") ?? "");
    let stage: "prep1" | "prep2" | "prep3" | null = null;
    if (stageRaw) {
      const stageParsed = stageSchema.safeParse(stageRaw);
      if (!stageParsed.success) return { error: firstZodMessage(stageParsed.error), success: null };
      stage = stageParsed.data;
    }
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
    return { error: safeErrorMessage(e, "updateUserAction"), success: null };
  }
}

export async function setUserStatusAction(userId: string, status: "active" | "disabled") {
  const parsedId = uuidSchema.safeParse(userId);
  if (!parsedId.success) throw new ExpectedError("معرّف غير صحيح.");
  if (status !== "active" && status !== "disabled") throw new ExpectedError("حالة غير صحيحة.");

  const { actorId } = await requireSuperAdmin();
  const serviceClient = createServiceClient();

  const { error } = await serviceClient.from("profiles").update({ status }).eq("id", parsedId.data);
  if (error) throw new ExpectedError("تعذّر تنفيذ العملية.");

  // تعطيل حساب كان بيغيّر عمود status بس — وده كافٍ لمنع أي query جديد لبيانات
  // (RLS بتتحقق من auth_status() حيًا في كل مرة)، لكن الـ access token اللي عند
  // المستخدم ممكن يفضل "صالح" تقنيًا لحد ما ينتهي (ساعة افتراضيًا)، ومع انتهائه
  // كان لسه يقدر يجدّده بالـ refresh token لأن مفيش حاجة في Supabase نفسه
  // بتمنعه. مفيش دالة في supabase-js اسمها "امسح كل جلسات مستخدم بمعرّفه" (اللي
  // فيه، auth.admin.signOut، بياخد JWT مش userId). الطريقة الرسمية المتاحة فعليًا
  // هي حظر تجديد الـ token عبر ban_duration: ده بيمنع أي refresh أو دخول جديد
  // فورًا، فالحد الأقصى لبقاء الجلسة شغالة بعد التعطيل بيبقى عمر الـ access token
  // الحالي بس (مش اللانهاية). "none" بيلغي الحظر عند إعادة التفعيل.
  const { error: banError } = await serviceClient.auth.admin.updateUserById(parsedId.data, {
    ban_duration: status === "disabled" ? "87600h" : "none" // 87600 ساعة ≈ 10 سنين
  });
  if (banError) {
    console.error("setUserStatusAction: ban_duration update failed", { error: banError.message });
    // منوقفش العملية الأساسية بسبب فشل الحظر — عمود status في profiles هو مصدر
    // الحقيقة اللي RLS بتتحقق منه، وده كافٍ لمنع الوصول للبيانات حتى لو فشل ده.
  }

  await logAuditEvent(serviceClient, {
    actorId,
    action: status === "disabled" ? "disable_user" : "enable_user",
    entityType: "profile",
    entityId: userId
  });

  revalidatePath("/admin/users");
}

/**
 * حذف حساب نهائيًا (وليس تعطيله فقط). عملية لا رجعة فيها، فبتتطلب كتابة رقم
 * هاتف الحساب المعروض بالظبط كتأكيد — ويتحقق من تطابقه مع الرقم الحقيقي
 * المخزَّن في قاعدة البيانات على الخادم (مش بس قيمة جاية من العميل)، عشان
 * ضغطة غلط أو طلب معدَّل يدويًا ميقدرش يحذف حساب غلط. migration 0016 عدّلت كل
 * الأعمدة اللي بتسجّل "مين نفّذ العملية" (سجل العمليات، منفّذ الحضور، منشئ
 * الإشعار...) لتبقى NULL بدل ما تمنع الحذف أو تمسح سجلات تانية بالغلط؛
 * البيانات الشخصية لصاحب الحساب نفسه (صلاته، قراءاته، حضوره، محاولاته) هي
 * اللي بتتمسح فعليًا معاه، لأنها بياناته هو.
 */
export async function deleteUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { actorId } = await requireSuperAdmin();
    const serviceClient = createServiceClient();

    const userIdParsed = uuidSchema.safeParse(formData.get("user_id"));
    if (!userIdParsed.success) return { error: "بيانات غير مكتملة.", success: null };
    const userId = userIdParsed.data;

    if (userId === actorId) {
      return { error: "لا يمكنك حذف حسابك الخاص.", success: null };
    }

    const { data: target } = await serviceClient
      .from("profiles")
      .select("full_name, phone_normalized, role")
      .eq("id", userId)
      .single();
    if (!target) return { error: "المستخدم غير موجود بالفعل.", success: null };

    const confirmPhone = String(formData.get("confirm_phone") ?? "").trim();
    const expectedPhone = formatPhoneForDisplay(target.phone_normalized);
    if (confirmPhone !== expectedPhone) {
      return { error: "رقم الهاتف المكتوب للتأكيد لا يطابق رقم هذا الحساب. اكتبه بالضبط كما هو معروض.", success: null };
    }

    // ملفات حل المسابقات (quiz-files/answers/<quizId>/<userId>/...) مش جزء من
    // قاعدة البيانات، فحذف صف quiz_attempts (بـ "on delete cascade" مع المستخدم)
    // ما بيمسحش الملف الفعلي من Storage — كان بيفضل "يتيم" هناك رغم إن رسالة
    // التأكيد بتقول إن بياناته هتتمسح نهائيًا. نجيب كل مسارات الملفات اللي رفعها
    // هذا المستخدم تحديدًا (من عمود answer_file_path المخزَّن في الصف نفسه، مش
    // بالتخمين من اسم المسار) ونمسحها هنا قبل حذف الحساب، وبعدين صفوف الجدول
    // هتتمسح تلقائيًا مع المستخدم زي ما هي.
    const { data: attempts } = await serviceClient
      .from("quiz_attempts")
      .select("answer_file_path")
      .eq("user_id", userId)
      .not("answer_file_path", "is", null);
    const filePaths = (attempts ?? []).map((a) => a.answer_file_path).filter((p): p is string => !!p);
    if (filePaths.length > 0) {
      await serviceClient.storage.from("quiz-files").remove(filePaths);
    }

    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      return { error: "تعذّر حذف الحساب. حاول مرة أخرى.", success: null };
    }

    await logAuditEvent(serviceClient, {
      actorId,
      action: "delete_user",
      entityType: "profile",
      entityId: userId,
      details: { full_name: target.full_name, role: target.role, phone_normalized: target.phone_normalized }
    });

    revalidatePath("/admin/users");
  } catch (e) {
    return { error: safeErrorMessage(e, "deleteUserAction"), success: null };
  }

  redirect("/admin/users");
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { actorId } = await requireSuperAdmin();
    const serviceClient = createServiceClient();

    const userIdParsed = uuidSchema.safeParse(formData.get("user_id"));
    if (!userIdParsed.success) return { error: "بيانات غير مكتملة.", success: null };
    const userId = userIdParsed.data;

    const passwordParsed = passwordSchema.safeParse(formData.get("password"));
    if (!passwordParsed.success) return { error: firstZodMessage(passwordParsed.error), success: null };
    const password = passwordParsed.data;

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
    // ملاحظة أمنية: ما كانش بيستخدم safeErrorMessage زي باقي الدوال في الملف، وكان بيرجّع
    // e.message الخام للعميل مباشرة — ده ممكن يكشف تفاصيل داخلية (رسائل Postgres/Supabase).
    return { error: safeErrorMessage(e, "resetPasswordAction"), success: null };
  }
}
