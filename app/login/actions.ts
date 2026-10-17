"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { normalizePhone, phoneToAuthEmail } from "@/lib/phone";
import { homePathForRole, type AppRole } from "@/lib/roles";
import { logAuditEvent, audit } from "@/lib/audit";

const IP_MAX_FAILS = 20; // أعلى من حد الهاتف (5) لأن خدام كتير ممكن يشاركوا نفس شبكة الكنيسة

export type LoginState = { error: string | null };

/** يحوّل عدد الثواني لنص عربي مفهوم ("دقيقتين" أفضل من "120 ثانية"). */
function formatWaitTime(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  if (minutes <= 1) return "دقيقة واحدة";
  return `${minutes} دقائق`;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const phoneRaw = String(formData.get("phone") ?? "");
  const password = String(formData.get("password") ?? "");

  const normalized = normalizePhone(phoneRaw);
  if (!normalized) {
    return { error: "رقم الهاتف غير صحيح، برجاء التأكد منه." };
  }
  if (!password) {
    return { error: "برجاء إدخال كلمة المرور." };
  }

  const supabase = createClient();
  // دالتا تقييد المحاولات (login_rate_limit_check/record) ممنوحتان لـ service_role
  // فقط (migration 0015) — لو ناديناهم من العميل العادي (مفتاح anon) أي زائر غير
  // مسجَّل دخول هيترفض النداء. لازم نستخدم عميل الخدمة هنا تحديدًا، وده آمن لأننا
  // بنستخدمه بس في النداءين الضيقين دول، مش في أي بيانات حساسة تانية.
  const serviceClient = createServiceClient();

  // عنوان الـ IP من x-forwarded-for: موثوق هنا لأن المنصة (Vercel) هي اللي بتحطه
  // بنفسها على حافة الشبكة، مش قيمة جاية من المتصفح مباشرة ممكن تتزوّر بسهولة.
  const ip = headers().get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const ipIdentifier = ip ? `ip:${ip}` : null;

  // حماية من محاولات تخمين كلمة المرور المتكررة: نفحص أولًا هل الرقم (أو الـ IP)
  // ده وصل للحد المسموح من المحاولات الفاشلة قبل ما نكلّف Supabase Auth أي نداء
  // شبكة (لو وصل للحد، منرفضش نسيب حتى فرصة تخمين واحدة زيادة). التقييد بالرقم
  // وبالـ IP معًا — IP واحد ممكن يكون شبكة كنيسة كاملة، فحده أعلى.
  const { data: phoneCheck } = await serviceClient.rpc("login_rate_limit_check", { p_identifier: normalized });
  if (phoneCheck && phoneCheck.allowed === false) {
    await audit({ actorId: null, action: "login_blocked", entityType: "session", details: { phone: normalized, ip, reason: "phone" } });
    return {
      error: `محاولات دخول كثيرة جدًا. برجاء الانتظار ${formatWaitTime(phoneCheck.retry_after_seconds)} ثم المحاولة مرة أخرى.`
    };
  }
  if (ipIdentifier) {
    const { data: ipCheck } = await serviceClient.rpc("login_rate_limit_check", {
      p_identifier: ipIdentifier,
      p_max_fails: IP_MAX_FAILS
    });
    if (ipCheck && ipCheck.allowed === false) {
      await audit({ actorId: null, action: "login_blocked", entityType: "session", details: { phone: normalized, ip, reason: "ip" } });
      return {
        error: `محاولات دخول كثيرة جدًا من نفس الشبكة. برجاء الانتظار ${formatWaitTime(ipCheck.retry_after_seconds)} ثم المحاولة مرة أخرى.`
      };
    }
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: phoneToAuthEmail(normalized),
    password
  });
  const succeeded = !!(data?.user && !error);

  // نسجّل نتيجة المحاولة (نجاح/فشل) بعد كده دايمًا، حتى لو حصل أي خطأ لاحق في
  // التحقق من البروفايل تحت — المهم إن محاولة كلمة المرور نفسها اتسجلت. ولو
  // نجحت، نمسح أي محاولات فاشلة سابقة لنفس الرقم/الـ IP، عشان عدّاد الفشل
  // يبدأ من جديد بدل ما يفضل متراكم من قبل الدخول الناجح.
  await serviceClient.rpc("login_rate_limit_record", { p_identifier: normalized, p_success: succeeded });
  if (ipIdentifier) await serviceClient.rpc("login_rate_limit_record", { p_identifier: ipIdentifier, p_success: succeeded });
  if (succeeded) {
    await serviceClient.rpc("login_rate_limit_clear", { p_identifier: normalized });
    if (ipIdentifier) await serviceClient.rpc("login_rate_limit_clear", { p_identifier: ipIdentifier });
  }

  if (error || !data.user) {
    // محاولة دخول غلط: المنفّذ غير معروف، فبنسجّل الرقم اللي اتكتب والـ IP.
    await logAuditEvent(serviceClient, { actorId: null, action: "login_failed", entityType: "session", details: { phone: normalized, ip } });
    return { error: "رقم الهاتف أو كلمة المرور غير صحيحة." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", data.user.id)
    .single();

  if (!profile) {
    await logAuditEvent(serviceClient, { actorId: null, action: "login_failed", entityType: "session", entityId: data.user.id, details: { phone: normalized, ip, reason: "no_profile" } });
    await supabase.auth.signOut();
    return { error: "لا يوجد حساب مرتبط بهذا الرقم في النظام." };
  }

  if (profile.status === "disabled") {
    await logAuditEvent(serviceClient, { actorId: data.user.id, action: "login_disabled", entityType: "session", details: ip ? { ip } : {} });
    await supabase.auth.signOut();
    return { error: "هذا الحساب معطّل حاليًا. برجاء التواصل مع أمين الخدمة." };
  }

  // تسجيل دخول ناجح (المحاولات الفاشلة والمحظورة بتتسجّل فوق).
  await logAuditEvent(serviceClient, { actorId: data.user.id, action: "login", entityType: "session", details: ip ? { ip } : {} });

  redirect(homePathForRole(profile.role as AppRole));
}
