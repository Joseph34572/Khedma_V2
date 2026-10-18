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

type RateLimitResult = { allowed: boolean; retry_after_seconds: number; attempt_id?: number };

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

  const supabase = await createClient();
  // دوال تقييد المحاولات (login_rate_limit_attempt/resolve) ممنوحة لـ service_role
  // فقط (migration 0022) — لو ناديناهم من العميل العادي (مفتاح anon) أي زائر غير
  // مسجَّل دخول هيترفض النداء. لازم نستخدم عميل الخدمة هنا تحديدًا، وده آمن لأننا
  // بنستخدمه بس في النداءين الضيقين دول، مش في أي بيانات حساسة تانية.
  const serviceClient = createServiceClient();

  // عنوان الـ IP من x-forwarded-for: موثوق هنا لأن المنصة (Vercel) هي اللي بتحطه
  // بنفسها على حافة الشبكة، مش قيمة جاية من المتصفح مباشرة ممكن تتزوّر بسهولة.
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const ipIdentifier = ip ? `ip:${ip}` : null;

  // حماية من محاولات تخمين كلمة المرور المتكررة: الفحص والتسجيل في خطوة واحدة
  // ذرّية (المحاولة بتتحسب "فاشلة" مقدّمًا تحت قفل في قاعدة البيانات)، فالطلبات
  // المتوازية مبتعدّيش كلها قبل ما تتحسب. التقييد بالرقم وبالـ IP معًا — IP واحد
  // ممكن يكون شبكة كنيسة كاملة، فحده أعلى. لو اترفض، منكلّمش Supabase Auth خالص.
  const { data: phoneCheck } = await serviceClient.rpc("login_rate_limit_attempt", { p_identifier: normalized });
  if (phoneCheck && phoneCheck.allowed === false) {
    await audit({ actorId: null, action: "login_blocked", entityType: "session", details: { phone: normalized, ip, reason: "phone" } });
    return {
      error: `محاولات دخول كثيرة جدًا. برجاء الانتظار ${formatWaitTime(phoneCheck.retry_after_seconds)} ثم المحاولة مرة أخرى.`
    };
  }
  let ipCheck: RateLimitResult | null = null;
  if (ipIdentifier) {
    ({ data: ipCheck } = await serviceClient.rpc("login_rate_limit_attempt", {
      p_identifier: ipIdentifier,
      p_max_fails: IP_MAX_FAILS
    }));
    if (ipCheck && ipCheck.allowed === false) {
      await audit({ actorId: null, action: "login_blocked", entityType: "session", details: { phone: normalized, ip, reason: "ip" } });
      return {
        error: `محاولات دخول كثيرة جدًا من نفس الشبكة. برجاء الانتظار ${formatWaitTime(ipCheck.retry_after_seconds)} ثم المحاولة مرة أخرى.`
      };
    }
  }

  // رمز CAPTCHA (لو Turnstile متفعّل) — Supabase نفسه هو اللي بيتحقق منه.
  const captchaToken = String(formData.get("cf-turnstile-response") ?? "") || undefined;
  const { data, error } = await supabase.auth.signInWithPassword({
    email: phoneToAuthEmail(normalized),
    password,
    options: captchaToken ? { captchaToken } : undefined
  });
  const succeeded = !!(data?.user && !error);

  // المحاولة اتسجّلت فاشلة مقدّمًا؛ لو نجحت نعلّمها ناجحة. فشل الرقم القديم بيتمسح،
  // لكن عدّاد الـ IP لأ: غير كده أي حد عنده حساب صحيح كان يقدر يصفّر العدّاد بدخول
  // ناجح كل شوية ويكمّل تخمين على أرقام تانية من نفس الشبكة.
  if (succeeded) {
    if (phoneCheck?.attempt_id) await serviceClient.rpc("login_rate_limit_resolve", { p_attempt_id: phoneCheck.attempt_id, p_clear: true });
    if (ipCheck?.attempt_id) await serviceClient.rpc("login_rate_limit_resolve", { p_attempt_id: ipCheck.attempt_id });
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
