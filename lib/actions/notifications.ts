"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAuditEvent, audit } from "@/lib/audit";
import { normalizePhone } from "@/lib/phone";
import { canViewAllStages, type AppRole, type Stage } from "@/lib/roles";
import { globalAudienceSegments, stageAudienceSegments, type AudienceSegment } from "@/lib/audienceSegments";
import { uuidSchema, safeUrlOrNull } from "@/lib/validation";
import { ExpectedError, safeErrorMessage } from "@/lib/safeError";

const MAX_TITLE_LEN = 150;
const MAX_BODY_LEN = 2000;
const MAX_SPECIFIC_PHONES = 200;

export type ComposeState = { error: string | null; success: string | null };
export type { AudienceSegment };

function segmentToQuery(segment: AudienceSegment): { role: AppRole; stage?: Stage } | "all" | null {
  if (segment === "all") return "all";
  if (segment === "general_secretary") return { role: "general_secretary" };
  if (segment === "super_admin") return { role: "super_admin" };
  const [role, stage] = segment.split(":") as [AppRole, Stage];
  if (!role || !stage) return null;
  return { role, stage };
}

async function resolveRecipients(
  supabase: Awaited<ReturnType<typeof createClient>>,
  senderRole: AppRole,
  senderStage: Stage | null,
  segments: AudienceSegment[],
  specificPhones: string[]
): Promise<{ ids?: string[]; error?: string }> {
  const isGlobal = canViewAllStages(senderRole);
  const allowed = new Set(isGlobal ? globalAudienceSegments() : senderStage ? stageAudienceSegments(senderStage) : []);
  const effective = segments.filter((s) => allowed.has(s));

  const ids = new Set<string>();

  if (effective.includes("all") && isGlobal) {
    const { data, error } = await supabase.from("profiles").select("id").eq("status", "active");
    if (error) return { error: "تعذّر تحديد المستلمين." };
    (data ?? []).forEach((d) => ids.add(d.id));
  } else {
    for (const segment of effective) {
      const parsed = segmentToQuery(segment);
      if (!parsed || parsed === "all") continue;
      let query = supabase.from("profiles").select("id").eq("status", "active").eq("role", parsed.role);
      if (parsed.stage) query = query.eq("stage_id", parsed.stage);
      const { data, error } = await query;
      if (error) return { error: "تعذّر تحديد المستلمين." };
      (data ?? []).forEach((d) => ids.add(d.id));
    }
  }

  if (specificPhones.length > 0) {
    const normalized = specificPhones.map(normalizePhone).filter(Boolean) as string[];
    if (normalized.length > 0) {
      const { data, error } = await supabase.from("profiles").select("id").in("phone_normalized", normalized);
      if (error) return { error: "تعذّر العثور على المستخدمين المحدَّدين." };
      (data ?? []).forEach((d) => ids.add(d.id));
    }
  }

  return { ids: Array.from(ids) };
}

export async function sendNotificationAction(_prev: ComposeState, formData: FormData): Promise<ComposeState> {
  try {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) throw new ExpectedError("غير مسجّل الدخول");

    const { data: me } = await supabase.from("profiles").select("role, stage_id").eq("id", user.id).single();
    if (!me) throw new ExpectedError("غير مسجّل الدخول");

    const role = me.role as AppRole;
    if (role === "member") {
      throw new ExpectedError("إرسال الإشعارات متاح للخدام والأمناء فقط.");
    }

    const title = String(formData.get("title") ?? "").trim();
    const body = String(formData.get("body") ?? "").trim();
    const linkUrlRaw = String(formData.get("link_url") ?? "").trim();
    const segments = formData.getAll("segments").map(String) as AudienceSegment[];
    const specificPhonesRaw = String(formData.get("specific_phones") ?? "");
    const specificPhones = specificPhonesRaw
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (!title || !body) return { error: "العنوان والنص مطلوبان.", success: null };
    if (title.length > MAX_TITLE_LEN) return { error: `العنوان يجب ألا يتجاوز ${MAX_TITLE_LEN} حرفًا.`, success: null };
    if (body.length > MAX_BODY_LEN) return { error: `النص يجب ألا يتجاوز ${MAX_BODY_LEN} حرفًا.`, success: null };
    if (specificPhones.length > MAX_SPECIFIC_PHONES) {
      return { error: `لا يمكن استهداف أكثر من ${MAX_SPECIFIC_PHONES} رقم محدَّد في نفس الوقت.`, success: null };
    }

    const urlResult = safeUrlOrNull(linkUrlRaw);
    if (!urlResult.ok) return { error: urlResult.error, success: null };
    const linkUrl = urlResult.value;

    if (segments.length === 0 && specificPhones.length === 0) {
      return { error: "اختر فئة مستهدفة واحدة على الأقل، أو أدخل أرقام هواتف محددة.", success: null };
    }

    const resolved = await resolveRecipients(supabase, role, me.stage_id as Stage | null, segments, specificPhones);
    if (resolved.error || !resolved.ids) return { error: resolved.error ?? "تعذّر تحديد المستلمين.", success: null };
    if (resolved.ids.length === 0) return { error: "لا يوجد مستلمون مطابقون لهذا الاستهداف.", success: null };

    // المستلمين اتحددوا فوق بعميل المستخدم نفسه (RLS)، فالخادم/أمين المرحلة مش بيوصل غير
    // لناس مرحلته، والفئات المسموحة اتفلترت حسب دوره. الإدراج نفسه بيتم بعميل service لأن
    // سياسات RLS على جدولي الإشعارات بتسمح بالكتابة للأمناء والمدير بس، والخادم بقى من حقه
    // يبعت لمرحلته — والتحقق من الصلاحية والمستلمين اتعمل هنا على السيرفر قبل الإدراج.
    const service = createServiceClient();
    const { data: notification, error: notifError } = await service
      .from("notifications")
      .insert({
        title,
        body,
        link_url: linkUrl,
        target_type: "custom",
        target_stage: null,
        target_role: null,
        sent_at: new Date().toISOString(),
        created_by: user.id
      })
      .select("id")
      .single();

    if (notifError || !notification) throw new ExpectedError("تعذّر إنشاء الإشعار.");

    const rows = resolved.ids.map((uid) => ({
      notification_id: notification.id,
      user_id: uid,
      channel: "in_app" as const,
      delivered_at: new Date().toISOString()
    }));
    const { error: recipientsError } = await service.from("notification_recipients").insert(rows);
    if (recipientsError) return { error: "تم إنشاء الإشعار لكن تعذّر إرساله لبعض المستلمين.", success: null };

    // بنسجّل العنوان وعدد المستلمين بس (مش النص الكامل) عشان السجل يفضل خفيف —
    // النص الكامل أصلًا محفوظ في جدول notifications نفسه.
    await logAuditEvent(service, {
      actorId: user.id,
      action: "send_notification",
      entityType: "notification",
      entityId: notification.id,
      details: { title, recipients: resolved.ids.length }
    });

    revalidatePath("/admin/notifications");
    revalidatePath("/servant/notifications");
    revalidatePath("/child/notifications");
    return { error: null, success: `تم إرسال الإشعار إلى ${resolved.ids.length} مستخدم بنجاح.` };
  } catch (e) {
    return { error: safeErrorMessage(e, "sendNotificationAction"), success: null };
  }
}

export async function markNotificationReadAction(recipientId: string): Promise<{ error?: string }> {
  try {
    const parsed = uuidSchema.safeParse(recipientId);
    if (!parsed.success) throw new ExpectedError("معرّف غير صحيح.");

    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) throw new ExpectedError("غير مسجّل الدخول");

    const { error } = await supabase
      .from("notification_recipients")
      .update({ read_at: new Date().toISOString() })
      .eq("id", parsed.data)
      .is("read_at", null);

    if (error) throw new ExpectedError("تعذّر تحديث حالة الإشعار.");
    await audit({ actorId: user.id, action: "read_notification", entityType: "notification_recipient", entityId: parsed.data });
    return {};
  } catch (e) {
    return { error: safeErrorMessage(e, "markNotificationReadAction") };
  }
}
