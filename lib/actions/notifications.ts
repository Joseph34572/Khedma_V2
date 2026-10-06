"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/phone";
import { canViewAllStages, type AppRole, type Stage } from "@/lib/roles";
import { globalAudienceSegments, stageAudienceSegments, type AudienceSegment } from "@/lib/audienceSegments";

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
  supabase: ReturnType<typeof createClient>,
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
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل الدخول", success: null };

  const { data: me } = await supabase.from("profiles").select("role, stage_id").eq("id", user.id).single();
  if (!me) return { error: "غير مسجّل الدخول", success: null };

  const role = me.role as AppRole;
  if (role !== "super_admin" && role !== "general_secretary" && role !== "stage_secretary") {
    return { error: "إرسال الإشعارات متاح للمدير/الأمين العام وأمين الخدمة فقط.", success: null };
  }

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const linkUrl = String(formData.get("link_url") ?? "").trim() || null;
  const segments = formData.getAll("segments").map(String) as AudienceSegment[];
  const specificPhonesRaw = String(formData.get("specific_phones") ?? "");
  const specificPhones = specificPhonesRaw.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);

  if (!title || !body) return { error: "العنوان والنص مطلوبان.", success: null };
  if (segments.length === 0 && specificPhones.length === 0) {
    return { error: "اختر فئة مستهدفة واحدة على الأقل، أو أدخل أرقام هواتف محددة.", success: null };
  }

  const resolved = await resolveRecipients(supabase, role, me.stage_id as Stage | null, segments, specificPhones);
  if (resolved.error || !resolved.ids) return { error: resolved.error ?? "تعذّر تحديد المستلمين.", success: null };
  if (resolved.ids.length === 0) return { error: "لا يوجد مستلمون مطابقون لهذا الاستهداف.", success: null };

  const { data: notification, error: notifError } = await supabase
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

  if (notifError || !notification) return { error: "تعذّر إنشاء الإشعار.", success: null };

  const rows = resolved.ids.map((uid) => ({ notification_id: notification.id, user_id: uid, channel: "in_app" as const, delivered_at: new Date().toISOString() }));
  const { error: recipientsError } = await supabase.from("notification_recipients").insert(rows);
  if (recipientsError) return { error: "تم إنشاء الإشعار لكن تعذّر إرساله لبعض المستلمين.", success: null };

  revalidatePath("/admin/notifications");
  revalidatePath("/servant/notifications");
  revalidatePath("/child/notifications");
  return { error: null, success: `تم إرسال الإشعار إلى ${resolved.ids.length} مستخدم بنجاح.` };
}

export async function markNotificationReadAction(recipientId: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل الدخول" };

  const { error } = await supabase
    .from("notification_recipients")
    .update({ read_at: new Date().toISOString() })
    .eq("id", recipientId)
    .is("read_at", null);

  if (error) return { error: "تعذّر تحديث حالة الإشعار." };
  return {};
}
