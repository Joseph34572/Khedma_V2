"use server";

import { audit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canManageContent, type AppRole } from "@/lib/roles";
import { uuidSchema } from "@/lib/validation";
import { ExpectedError, safeErrorMessage } from "@/lib/safeError";

export type ActionState = { error: string | null; success: string | null };

const MAX_TITLE = 200;
const MAX_BODY = 20_000;

async function requireContentManager() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new ExpectedError("غير مسجّل الدخول");

  const { data: profile } = await supabase.from("profiles").select("role, status").eq("id", user.id).single();
  if (!profile || profile.status !== "active" || !canManageContent(profile.role as AppRole)) {
    throw new ExpectedError("هذه العملية غير متاحة لدورك الحالي.");
  }
  return { supabase, userId: user.id };
}

function revalidatePrayer(prayerId?: string) {
  for (const base of ["/admin/content/prayer", "/servant/content/prayer"]) {
    revalidatePath(base);
    if (prayerId) revalidatePath(`${base}/${prayerId}`);
  }
  revalidatePath("/child/prayer");
  revalidatePath("/servant/prayer");
}

function readSectionFields(formData: FormData): { title: string; body: string } | { error: string } {
  const title = String(formData.get("title_ar") ?? "").trim();
  // النص بيتحفظ زي ما اتكتب بالظبط (من غير تعديل جوه السطور)، بس من غير مسافات زيادة في الأول والآخر.
  const body = String(formData.get("body_ar") ?? "").replace(/\r\n/g, "\n").trim();
  if (!title) return { error: "اكتب عنوان الجزء." };
  if (title.length > MAX_TITLE) return { error: "العنوان طويل جدًا." };
  if (!body) return { error: "اكتب نص الجزء." };
  if (body.length > MAX_BODY) return { error: "النص طويل جدًا." };
  return { title, body };
}

/** تعديل عنوان ونص جزء موجود من أجزاء صلاة. */
export async function updatePrayerSectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { supabase, userId } = await requireContentManager();
    const id = uuidSchema.safeParse(formData.get("section_id"));
    if (!id.success) return { error: "بيانات غير مكتملة.", success: null };
    const fields = readSectionFields(formData);
    if ("error" in fields) return { error: fields.error, success: null };

    const { data: before } = await supabase
      .from("prayer_sections")
      .select("prayer_content_id, sort_order, title_ar, body_ar")
      .eq("id", id.data)
      .maybeSingle();
    if (!before) return { error: "الجزء غير موجود.", success: null };

    const { error } = await supabase
      .from("prayer_sections")
      .update({ title_ar: fields.title, body_ar: fields.body })
      .eq("id", id.data);
    if (error) return { error: "تعذّر حفظ التعديلات.", success: null };

    await audit({
      actorId: userId,
      action: "update_prayer_section",
      entityType: "prayer_section",
      entityId: id.data,
      details: {
        prayer_content_id: before.prayer_content_id,
        sort_order: before.sort_order,
        title_before: before.title_ar,
        title_after: fields.title,
        length_before: before.body_ar.length,
        length_after: fields.body.length
      }
    });

    revalidatePrayer(before.prayer_content_id);
    return { error: null, success: "تم حفظ الجزء." };
  } catch (e) {
    return { error: safeErrorMessage(e, "prayer content"), success: null };
  }
}

/** إضافة جزء جديد في آخر الصلاة. */
export async function addPrayerSectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { supabase, userId } = await requireContentManager();
    const prayerId = uuidSchema.safeParse(formData.get("prayer_content_id"));
    if (!prayerId.success) return { error: "بيانات غير مكتملة.", success: null };
    const fields = readSectionFields(formData);
    if ("error" in fields) return { error: fields.error, success: null };

    const { data: last } = await supabase
      .from("prayer_sections")
      .select("sort_order")
      .eq("prayer_content_id", prayerId.data)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const sortOrder = (last?.sort_order ?? 0) + 1;

    const { data: created, error } = await supabase
      .from("prayer_sections")
      .insert({ prayer_content_id: prayerId.data, sort_order: sortOrder, title_ar: fields.title, body_ar: fields.body })
      .select("id")
      .single();
    if (error) return { error: "تعذّر إضافة الجزء.", success: null };

    await audit({
      actorId: userId,
      action: "add_prayer_section",
      entityType: "prayer_section",
      entityId: created?.id,
      details: { prayer_content_id: prayerId.data, sort_order: sortOrder, title: fields.title, length: fields.body.length }
    });

    revalidatePrayer(prayerId.data);
    return { error: null, success: "تمت إضافة الجزء في آخر الصلاة." };
  } catch (e) {
    return { error: safeErrorMessage(e, "prayer content"), success: null };
  }
}

/** حذف جزء من الصلاة (النص بيتحفظ في سجل العمليات عشان لو اتحذف بالغلط يرجع). */
export async function deletePrayerSectionAction(sectionId: string): Promise<{ error?: string }> {
  try {
    const { supabase, userId } = await requireContentManager();
    const id = uuidSchema.safeParse(sectionId);
    if (!id.success) return { error: "معرّف غير صحيح." };

    const { data: before } = await supabase
      .from("prayer_sections")
      .select("prayer_content_id, sort_order, title_ar, body_ar")
      .eq("id", id.data)
      .maybeSingle();
    if (!before) return { error: "الجزء غير موجود." };

    const { error } = await supabase.from("prayer_sections").delete().eq("id", id.data);
    if (error) return { error: "تعذّر حذف الجزء." };

    await audit({
      actorId: userId,
      action: "delete_prayer_section",
      entityType: "prayer_section",
      entityId: id.data,
      details: { prayer_content_id: before.prayer_content_id, sort_order: before.sort_order, title: before.title_ar, body: before.body_ar }
    });

    revalidatePrayer(before.prayer_content_id);
    return {};
  } catch (e) {
    return { error: safeErrorMessage(e, "prayer content") };
  }
}

/** تفعيل/إلغاء تفعيل صلاة. التفعيل محتاج جزء واحد على الأقل فيه نص. */
export async function setPrayerActiveAction(prayerId: string, active: boolean): Promise<{ error?: string }> {
  try {
    const { supabase, userId } = await requireContentManager();
    const id = uuidSchema.safeParse(prayerId);
    if (!id.success) return { error: "معرّف غير صحيح." };

    if (active) {
      const { count } = await supabase
        .from("prayer_sections")
        .select("id", { count: "exact", head: true })
        .eq("prayer_content_id", id.data)
        .neq("body_ar", "");
      if (!count) return { error: "لا يمكن تفعيل الصلاة قبل إضافة جزء واحد على الأقل بنصه." };
    }

    const { error } = await supabase.from("prayer_contents").update({ is_active: active }).eq("id", id.data);
    if (error) return { error: "تعذّر تنفيذ العملية." };

    await audit({ actorId: userId, action: active ? "activate_prayer" : "deactivate_prayer", entityType: "prayer_content", entityId: id.data });

    revalidatePrayer(id.data);
    return {};
  } catch (e) {
    return { error: safeErrorMessage(e, "prayer content") };
  }
}
