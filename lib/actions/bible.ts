"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { canManageContent, type AppRole } from "@/lib/roles";

// متوسط سرعة قراءة الكتاب المقدس بتركيز (كلمة/دقيقة) — رقم معقول لقراءة هادئة
// وليست سريعة، يُستخدم لحساب "الوقت المتوقع" للإصحاح من عدد كلماته.
const BIBLE_READING_WORDS_PER_MINUTE = 120;

// أقل وقت نشاط (ثانية) يُعتبر بعده المستخدم "متوسط النشاط" في لوحات المتابعة فقط.
const READING_ACTIVE_SECONDS_MEDIUM = 60;

/** يحسب عدد كلمات نص الآيات، ثم الوقت المتوقع بالثواني لقراءتها بالكامل. */
function expectedReadingSeconds(versesText: string): number {
  const wordCount = versesText
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean).length;
  const minutes = wordCount / BIBLE_READING_WORDS_PER_MINUTE;
  return Math.max(30, Math.round(minutes * 60)); // 30 ثانية كحد أدنى حتى للإصحاحات القصيرة جدًا
}

export async function startReadingSessionAction(chapterId: string): Promise<{ sessionId: string } | { error: string }> {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل الدخول" };

  const { data, error } = await supabase
    .from("bible_reading_sessions")
    .insert({ user_id: user.id, chapter_id: chapterId, status: "in_progress" })
    .select("id")
    .single();

  if (error || !data) return { error: "تعذّر بدء جلسة القراءة" };
  return { sessionId: data.id };
}

export async function finishReadingSessionAction(params: {
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

  const activeSeconds = Math.max(0, Math.round(params.activeSeconds));
  const progressPercent = Math.min(100, Math.max(0, Math.round(params.progressPercent)));

  // نجيب الإصحاح المرتبط بالجلسة عشان نحسب عدد كلماته، وعلى أساسه الوقت المتوقع للقراءة.
  const { data: session } = await supabase
    .from("bible_reading_sessions")
    .select("chapter_id")
    .eq("id", params.sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  let requiredSeconds = 180; // قيمة احتياطية لو تعذّر جلب نص الآيات لأي سبب
  if (session?.chapter_id) {
    const { data: verses } = await supabase.from("bible_verses").select("text_ar").eq("chapter_id", session.chapter_id);
    if (verses && verses.length > 0) {
      requiredSeconds = expectedReadingSeconds(verses.map((v) => v.text_ar).join(" "));
    }
  }

  const activityLevel = activeSeconds >= requiredSeconds ? "high" : activeSeconds >= READING_ACTIVE_SECONDS_MEDIUM ? "medium" : "low";

  // الاكتمال: لو الوقت النشط الفعلي تخطّى الوقت المتوقع للقراءة المحسوب من عدد الكلمات.
  const completionLevel =
    !params.abandoned && activeSeconds >= requiredSeconds ? "likely_complete" : activeSeconds > 0 ? "partial" : "not_started";

  const { error } = await supabase
    .from("bible_reading_sessions")
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

  await supabase.from("bible_reading_activity_events").insert({
    session_id: params.sessionId,
    event_type: "session_summary",
    payload: { active_seconds: activeSeconds, progress_percent: progressPercent }
  });

  revalidatePath("/child/bible");
  revalidatePath("/servant/bible");
  return { ok: true };
}

export type ImportChapterState = { error: string | null; success: string | null };

/** استيراد إصحاح كامل: يلصق المدير النص من مصدر معتمد بصيغة "رقم الآية نص الآية" كل آية في سطر */
export async function importChapterAction(_prev: ImportChapterState, formData: FormData): Promise<ImportChapterState> {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل الدخول", success: null };

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!me || !canManageContent(me.role as AppRole)) {
    return { error: "هذه العملية غير متاحة لدورك الحالي.", success: null };
  }

  const bookId = Number(formData.get("book_id"));
  const chapterNumber = Number(formData.get("chapter_number"));
  const raw = String(formData.get("verses_text") ?? "").trim();

  if (!bookId || !chapterNumber || !raw) {
    return { error: "من فضلك أكمل كل الحقول.", success: null };
  }

  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const verses: { verse_number: number; text_ar: string }[] = [];
  for (const line of lines) {
    const match = line.match(/^(\d+)[.\-:\s]+(.+)$/);
    if (!match) {
      return { error: `تعذّر فهم هذا السطر (يجب أن يبدأ برقم الآية): "${line.slice(0, 40)}..."`, success: null };
    }
    verses.push({ verse_number: Number(match[1]), text_ar: (match[2] ?? "").trim() });
  }

  if (verses.length === 0) {
    return { error: "لم يتم العثور على آيات صالحة في النص الملصوق.", success: null };
  }

  const serviceClient = createServiceClient();

  const { data: existingChapter } = await serviceClient
    .from("bible_chapters")
    .select("id")
    .eq("book_id", bookId)
    .eq("chapter_number", chapterNumber)
    .maybeSingle();

  let chapterId = existingChapter?.id as string | undefined;

  if (!chapterId) {
    const { data: created, error: chapterError } = await serviceClient
      .from("bible_chapters")
      .insert({ book_id: bookId, chapter_number: chapterNumber })
      .select("id")
      .single();
    if (chapterError || !created) return { error: "تعذّر إنشاء الإصحاح.", success: null };
    chapterId = created.id;
  } else {
    await serviceClient.from("bible_verses").delete().eq("chapter_id", chapterId);
  }

  const { error: versesError } = await serviceClient
    .from("bible_verses")
    .insert(verses.map((v) => ({ chapter_id: chapterId!, verse_number: v.verse_number, text_ar: v.text_ar })));

  if (versesError) return { error: "تعذّر حفظ الآيات.", success: null };

  revalidatePath("/admin/content/bible");
  revalidatePath("/servant/content/bible");
  return { error: null, success: `تم استيراد ${verses.length} آية بنجاح.` };
}
