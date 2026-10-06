"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canManageContent, type AppRole } from "@/lib/roles";

export type ActionState = { error: string | null; success: string | null };

async function requireContentManager() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("غير مسجّل الدخول");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !canManageContent(profile.role as AppRole)) {
    throw new Error("هذه العملية غير متاحة لدورك الحالي.");
  }
  return supabase;
}

export async function updatePrayerContentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const supabase = await requireContentManager();
    const id = String(formData.get("id") ?? "");
    const bodyAr = String(formData.get("body_ar") ?? "").trim();
    const isActive = formData.get("is_active") === "on";

    if (isActive && bodyAr.length < 20) {
      return { error: "لا يمكن تفعيل الصلاة قبل إدخال نصها كاملًا.", success: null };
    }

    const { error } = await supabase.from("prayer_contents").update({ body_ar: bodyAr, is_active: isActive }).eq("id", id);
    if (error) return { error: "تعذّر حفظ التعديلات.", success: null };

    revalidatePath("/admin/content/prayer");
    revalidatePath("/servant/content/prayer");
    return { error: null, success: "تم حفظ نص الصلاة بنجاح." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "حدث خطأ غير متوقع.", success: null };
  }
}
