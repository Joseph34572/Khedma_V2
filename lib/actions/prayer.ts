"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// مدة الصلاة الثابتة التي تُحتسب بعدها الصلاة "مكتملة" (بالثواني) — 5 دقائق بالظبط،
// بغضّ النظر عن طول المحتوى أو نسبة التمرير (progress). هذا الرقم ثابت لكل الصلوات.
const PRAYER_COMPLETION_SECONDS = 5 * 60;

// حدّ "النشاط المتوسط" لعرضه فقط في لوحات المتابعة (activity_level)، لا علاقة له بالاكتمال.
const PRAYER_ACTIVE_SECONDS_MEDIUM = 60;

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function startPrayerSessionAction(
  prayerContentId: string
): Promise<{ sessionId: string; priorActiveSeconds: number } | { error: string }> {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل الدخول" };

  // لوج واحد فقط لكل صلاة في اليوم: لو الولد دخل نفس الصلاة قبل كده النهارده، نكمّل
  // على نفس السجل بدل ما نعمل سجل جديد (والوقت يتجمّع تراكميًا).
  const { data: existing } = await supabase
    .from("prayer_sessions")
    .select("id, active_seconds")
    .eq("user_id", user.id)
    .eq("prayer_content_id", prayerContentId)
    .gte("started_at", startOfTodayIso())
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("prayer_sessions")
      .update({ status: "in_progress", ended_at: null })
      .eq("id", existing.id)
      .eq("user_id", user.id);
    return { sessionId: existing.id, priorActiveSeconds: existing.active_seconds ?? 0 };
  }

  const { data, error } = await supabase
    .from("prayer_sessions")
    .insert({ user_id: user.id, prayer_content_id: prayerContentId, status: "in_progress" })
    .select("id")
    .single();

  if (error || !data) return { error: "تعذّر بدء جلسة الصلاة" };
  return { sessionId: data.id, priorActiveSeconds: 0 };
}

export async function finishPrayerSessionAction(params: {
  sessionId: string;
  activeSeconds: number;
  progressPercent: number;
  abandoned?: boolean;
}): Promise<{ ok: true } | { error: string }> {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل الدخول" };

  // activeSeconds القادم من العميل هو الإجمالي التراكمي للصلاة في نفس اليوم (العميل
  // يبدأ العدّ من priorActiveSeconds المُستلمة عند البدء)، فنخزّنه كما هو.
  const activeSeconds = Math.max(0, Math.round(params.activeSeconds));
  const progressPercent = Math.min(100, Math.max(0, Math.round(params.progressPercent)));

  const activityLevel =
    activeSeconds >= PRAYER_COMPLETION_SECONDS ? "high" : activeSeconds >= PRAYER_ACTIVE_SECONDS_MEDIUM ? "medium" : "low";

  // الاكتمال يعتمد على عتبة وقت ثابتة فقط (5 دقائق) — مفيش علاقة بنسبة التمرير progress.
  const completionLevel = activeSeconds >= PRAYER_COMPLETION_SECONDS ? "likely_complete" : activeSeconds > 0 ? "partial" : "not_started";

  const { error } = await supabase
    .from("prayer_sessions")
    .update({
      ended_at: new Date().toISOString(),
      active_seconds: activeSeconds,
      progress_percent: progressPercent,
      activity_level: activityLevel,
      completion_level: completionLevel,
      status: params.abandoned ? "abandoned" : "completed"
    })
    .eq("id", params.sessionId)
    .eq("user_id", user.id);

  if (error) return { error: "تعذّر حفظ نتيجة الجلسة" };

  // حدث نشاط مجمّع واحد يلخّص الجلسة، بدلًا من تسجيل كل تفاعل بسيط على حدة
  await supabase.from("prayer_activity_events").insert({
    session_id: params.sessionId,
    event_type: "session_summary",
    payload: { active_seconds: activeSeconds, progress_percent: progressPercent }
  });

  revalidatePath("/child/prayer");
  revalidatePath("/servant/prayer");
  return { ok: true };
}
