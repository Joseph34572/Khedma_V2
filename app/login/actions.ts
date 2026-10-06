"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone, phoneToAuthEmail } from "@/lib/phone";
import { homePathForRole, type AppRole } from "@/lib/roles";

export type LoginState = { error: string | null };

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
  const { data, error } = await supabase.auth.signInWithPassword({
    email: phoneToAuthEmail(normalized),
    password
  });

  if (error || !data.user) {
    return { error: "رقم الهاتف أو كلمة المرور غير صحيحة." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", data.user.id)
    .single();

  if (!profile) {
    await supabase.auth.signOut();
    return { error: "لا يوجد حساب مرتبط بهذا الرقم في النظام." };
  }

  if (profile.status === "disabled") {
    await supabase.auth.signOut();
    return { error: "هذا الحساب معطّل حاليًا. برجاء التواصل مع أمين الخدمة." };
  }

  redirect(homePathForRole(profile.role as AppRole));
}
