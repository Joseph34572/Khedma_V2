"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAuditEvent } from "@/lib/audit";
import { canViewAllStages, type AppRole } from "@/lib/roles";

const BUCKET = "quiz-files";
const MAX_BYTES = 10 * 1024 * 1024;
const MIME_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};
const GRACE_SECONDS = 30;

type FileMeta = { name: string; type: string; size: number };

async function currentUser() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role, stage_id, status").eq("id", user.id).single();
  if (!profile || profile.status !== "active") return null;
  return { supabase, user, role: profile.role as AppRole, stageId: profile.stage_id };
}

function validateFile(f: FileMeta): string | null {
  if (!MIME_EXT[f.type]) return "نوع الملف غير مسموح. المسموح: صورة (JPG/PNG/WEBP) أو PDF.";
  if (f.size <= 0 || f.size > MAX_BYTES) return "حجم الملف يجب ألا يتجاوز 10 ميجابايت.";
  return null;
}

async function objectInfo(path: string) {
  const service = createServiceClient();
  const idx = path.lastIndexOf("/");
  const { data } = await service.storage.from(BUCKET).list(path.slice(0, idx), { search: path.slice(idx + 1), limit: 5 });
  const found = (data ?? []).find((o) => o.name === path.slice(idx + 1));
  if (!found) return null;
  const meta = (found.metadata ?? {}) as { size?: number; mimetype?: string };
  return { size: meta.size ?? 0, mimetype: meta.mimetype ?? "" };
}

async function signedUpload(path: string) {
  const service = createServiceClient();
  const { data, error } = await service.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return null;
  return { path, token: data.token };
}

async function signedUrl(path: string) {
  const service = createServiceClient();
  const { data } = await service.storage.from(BUCKET).createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

// ---------------------------------------------------------------------------
// إنشاء المسابقة (الخدام والأمناء)
// ---------------------------------------------------------------------------
export async function prepareQuizAttachmentUploadAction(file: FileMeta): Promise<{ path: string; token: string } | { error: string }> {
  const me = await currentUser();
  if (!me || me.role === "member") return { error: "غير مصرح" };
  const bad = validateFile(file);
  if (bad) return { error: bad };
  const path = `attachments/${me.user.id}/${randomUUID()}.${MIME_EXT[file.type]}`;
  const up = await signedUpload(path);
  return up ?? { error: "تعذّر تجهيز رفع الملف" };
}

const choiceSchema = z.object({ text: z.string().trim().min(1).max(200), correct: z.boolean() });
const questionSchema = z.object({
  type: z.enum(["single_choice", "multiple_choice", "true_false", "text"]),
  prompt: z.string().trim().min(2).max(500),
  points: z.number().int().min(1).max(100),
  choices: z.array(choiceSchema).max(8)
});
const quizSchema = z.object({
  title: z.string().trim().min(2).max(150),
  description: z.string().trim().max(1000).optional().default(""),
  stageId: z.enum(["prep1", "prep2", "prep3"]).nullable(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  durationMinutes: z.number().int().min(1).max(240),
  maxAttempts: z.number().int().min(1).max(10),
  mode: z.enum(["questions", "file"]),
  maxScore: z.number().min(1).max(1000).optional(),
  attachmentPath: z.string().nullable().optional(),
  attachmentName: z.string().max(150).nullable().optional(),
  questions: z.array(questionSchema).max(60)
});

export async function createQuizAction(input: unknown): Promise<{ id: string } | { error: string }> {
  const me = await currentUser();
  if (!me || me.role === "member") return { error: "غير مصرح لك بإنشاء مسابقة" };

  const parsed = quizSchema.safeParse(input);
  if (!parsed.success) return { error: "بيانات المسابقة غير مكتملة أو غير صحيحة." };
  const q = parsed.data;

  if (new Date(q.endsAt) <= new Date(q.startsAt)) return { error: "وقت النهاية يجب أن يكون بعد وقت البداية." };

  const global = canViewAllStages(me.role);
  if (!global && q.stageId !== me.stageId) return { error: "يمكنك إنشاء مسابقات لمرحلتك فقط." };

  let maxScore = q.maxScore ?? 100;
  if (q.mode === "file") {
    if (!q.attachmentPath || !q.attachmentPath.startsWith(`attachments/${me.user.id}/`)) return { error: "ارفع ملف المسابقة (صورة أو PDF)." };
    const info = await objectInfo(q.attachmentPath);
    if (!info) return { error: "لم يتم العثور على الملف المرفوع. حاول رفعه مرة أخرى." };
  } else {
    if (q.questions.length === 0) return { error: "أضف سؤالًا واحدًا على الأقل." };
    for (const [i, qu] of q.questions.entries()) {
      const correct = qu.choices.filter((c) => c.correct).length;
      const n = i + 1;
      if (qu.type === "text" && qu.choices.length > 0) return { error: `السؤال ${n}: السؤال النصي لا يحتوي اختيارات.` };
      if (qu.type === "true_false" && (qu.choices.length !== 2 || correct !== 1)) return { error: `السؤال ${n}: حدّد الإجابة الصحيحة (صح أو خطأ).` };
      if (qu.type === "single_choice" && (qu.choices.length < 2 || correct !== 1)) return { error: `السؤال ${n}: أضف اختيارين على الأقل وحدّد إجابة صحيحة واحدة.` };
      if (qu.type === "multiple_choice" && (qu.choices.length < 2 || correct < 1)) return { error: `السؤال ${n}: أضف اختيارين على الأقل وحدّد إجابة صحيحة واحدة أو أكثر.` };
    }
    maxScore = q.questions.reduce((sum, qu) => sum + qu.points, 0);
  }

  const { data: quiz, error } = await me.supabase
    .from("quizzes")
    .insert({
      title_ar: q.title,
      description_ar: q.description || null,
      stage_id: q.stageId,
      starts_at: q.startsAt,
      ends_at: q.endsAt,
      duration_seconds: q.durationMinutes * 60,
      max_attempts: q.maxAttempts,
      created_by: me.user.id,
      quiz_mode: q.mode,
      attachment_path: q.mode === "file" ? q.attachmentPath ?? null : null,
      attachment_name: q.mode === "file" ? q.attachmentName ?? null : null,
      max_score: maxScore
    })
    .select("id")
    .single();
  if (error || !quiz) return { error: "تعذّر إنشاء المسابقة." };

  if (q.mode === "questions") {
    for (const [i, qu] of q.questions.entries()) {
      const { data: qRow, error: qErr } = await me.supabase
        .from("quiz_questions")
        .insert({ quiz_id: quiz.id, question_type: qu.type, prompt: qu.prompt, sort_order: i, points: qu.points })
        .select("id")
        .single();
      if (qErr || !qRow) {
        await me.supabase.from("quizzes").delete().eq("id", quiz.id);
        return { error: "تعذّر حفظ الأسئلة." };
      }
      if (qu.choices.length > 0) {
        const choices =
          qu.type === "true_false"
            ? [
                { choice_text: "صح", is_correct: qu.choices.findIndex((c) => c.correct) === 0 },
                { choice_text: "خطأ", is_correct: qu.choices.findIndex((c) => c.correct) === 1 }
              ]
            : qu.choices.map((c) => ({ choice_text: c.text, is_correct: c.correct }));
        const { error: cErr } = await me.supabase
          .from("quiz_question_choices")
          .insert(choices.map((c, idx) => ({ question_id: qRow.id, choice_text: c.choice_text, is_correct: c.is_correct, sort_order: idx })));
        if (cErr) {
          await me.supabase.from("quizzes").delete().eq("id", quiz.id);
          return { error: "تعذّر حفظ الاختيارات." };
        }
      }
    }
  }

  await logAuditEvent(createServiceClient(), {
    actorId: me.user.id,
    action: "create_quiz",
    entityType: "quiz",
    entityId: quiz.id,
    details: { title: q.title, mode: q.mode, stage_id: q.stageId }
  });

  revalidatePath("/servant/quizzes");
  revalidatePath("/admin/quizzes");
  revalidatePath("/child/quizzes");
  return { id: quiz.id };
}

async function removeFolder(prefix: string, depth = 0) {
  if (depth > 4) return;
  const service = createServiceClient();
  const { data } = await service.storage.from(BUCKET).list(prefix, { limit: 1000 });
  const files: string[] = [];
  for (const entry of data ?? []) {
    if (entry.id) files.push(`${prefix}/${entry.name}`);
    else await removeFolder(`${prefix}/${entry.name}`, depth + 1);
  }
  if (files.length) await service.storage.from(BUCKET).remove(files);
}

export async function deleteQuizAction(quizId: string): Promise<{ error?: string }> {
  const me = await currentUser();
  if (!me || me.role === "member") return { error: "غير مصرح" };
  const { data: quiz } = await me.supabase.from("quizzes").select("id, title_ar, attachment_path").eq("id", quizId).maybeSingle();
  if (!quiz) return { error: "المسابقة غير موجودة" };
  const { data: deleted, error } = await me.supabase.from("quizzes").delete().eq("id", quizId).select("id");
  if (error || !deleted || deleted.length === 0) return { error: "لا تملك صلاحية حذف هذه المسابقة" };

  const service = createServiceClient();
  if (quiz.attachment_path) await service.storage.from(BUCKET).remove([quiz.attachment_path]);
  await removeFolder(`answers/${quizId}`);
  await logAuditEvent(service, { actorId: me.user.id, action: "delete_quiz", entityType: "quiz", entityId: quizId, details: { title: quiz.title_ar } });

  revalidatePath("/servant/quizzes");
  revalidatePath("/admin/quizzes");
  revalidatePath("/child/quizzes");
  return {};
}

// ---------------------------------------------------------------------------
// حل المسابقة (الأولاد)
// ---------------------------------------------------------------------------
async function loadOpenQuiz(quizId: string, me: NonNullable<Awaited<ReturnType<typeof currentUser>>>) {
  const { data: quiz } = await me.supabase.from("quizzes").select("*").eq("id", quizId).maybeSingle(); // RLS: مرحلة الولد فقط
  if (!quiz) return { error: "المسابقة غير متاحة لك", quiz: null };
  const now = Date.now();
  if (now < new Date(quiz.starts_at).getTime()) return { error: "المسابقة لم تبدأ بعد", quiz: null };
  if (now > new Date(quiz.ends_at).getTime()) return { error: "انتهى وقت المسابقة", quiz: null };
  return { error: null, quiz };
}

/** ينهي تلقائيًا المحاولات التي انتهى وقتها دون تسليم (بدون درجة) */
async function closeExpiredAttempts(quizId: string, userId: string, durationSeconds: number) {
  const service = createServiceClient();
  const cutoff = new Date(Date.now() - (durationSeconds + GRACE_SECONDS) * 1000).toISOString();
  await service
    .from("quiz_attempts")
    .update({ submitted_at: new Date().toISOString(), score: 0 })
    .eq("quiz_id", quizId)
    .eq("user_id", userId)
    .is("submitted_at", null)
    .lt("started_at", cutoff);
}

export async function startQuizAttemptAction(quizId: string): Promise<{ attemptId: string } | { error: string }> {
  const me = await currentUser();
  if (!me || me.role !== "member") return { error: "المسابقات للأولاد فقط" };
  const open = await loadOpenQuiz(quizId, me);
  if (open.error !== null) return { error: open.error };
  const { quiz } = open;
  if (quiz.quiz_mode !== "questions") return { error: "هذه مسابقة رفع ملف" };

  await closeExpiredAttempts(quizId, me.user.id, quiz.duration_seconds);
  const service = createServiceClient();
  const { data: attempts } = await service.from("quiz_attempts").select("id, attempt_number, submitted_at").eq("quiz_id", quizId).eq("user_id", me.user.id);
  const inProgress = (attempts ?? []).find((a) => !a.submitted_at);
  if (inProgress) return { attemptId: inProgress.id };

  const submittedCount = (attempts ?? []).length;
  if (submittedCount >= quiz.max_attempts) return { error: "استنفدت عدد المحاولات المسموح بها" };

  const nextNumber = Math.max(0, ...(attempts ?? []).map((a) => a.attempt_number)) + 1;
  const { data: created, error } = await service
    .from("quiz_attempts")
    .insert({ quiz_id: quizId, user_id: me.user.id, attempt_number: nextNumber })
    .select("id")
    .single();
  if (error || !created) return { error: "تعذّر بدء المحاولة. حاول مرة أخرى." };
  return { attemptId: created.id };
}

export type AnswerMap = Record<string, { choiceIds?: string[]; text?: string }>;

export async function submitQuizAttemptAction(attemptId: string, answers: AnswerMap): Promise<{ ok: true } | { error: string }> {
  const me = await currentUser();
  if (!me || me.role !== "member") return { error: "غير مصرح" };
  const service = createServiceClient();

  const { data: attempt } = await service.from("quiz_attempts").select("*").eq("id", attemptId).eq("user_id", me.user.id).maybeSingle();
  if (!attempt) return { error: "المحاولة غير موجودة" };
  if (attempt.submitted_at) return { error: "تم تسليم هذه المحاولة من قبل" };

  const { data: quiz } = await service.from("quizzes").select("id, duration_seconds").eq("id", attempt.quiz_id).single();
  if (!quiz) return { error: "المسابقة غير موجودة" };

  const deadline = new Date(attempt.started_at).getTime() + (quiz.duration_seconds + GRACE_SECONDS) * 1000;
  if (Date.now() > deadline) {
    await service.from("quiz_attempts").update({ submitted_at: new Date().toISOString(), score: 0 }).eq("id", attemptId);
    return { error: "انتهى وقت المحاولة قبل التسليم، وتم تسجيلها بدون درجة." };
  }

  const { data: questions } = await service.from("quiz_questions").select("id, question_type, points").eq("quiz_id", quiz.id);
  const qIds = (questions ?? []).map((x) => x.id);
  const { data: choices } = await service.from("quiz_question_choices").select("id, question_id, is_correct").in("question_id", qIds);

  let score = 0;
  let needsReview = false;
  const rows: { attempt_id: string; question_id: string; selected_choice_ids: string[]; text_answer: string | null; is_correct: boolean | null }[] = [];

  for (const qu of questions ?? []) {
    const own = (choices ?? []).filter((c) => c.question_id === qu.id);
    const given = answers[qu.id] ?? {};
    if (qu.question_type === "text") {
      needsReview = true;
      rows.push({ attempt_id: attemptId, question_id: qu.id, selected_choice_ids: [], text_answer: (given.text ?? "").slice(0, 2000), is_correct: null });
      continue;
    }
    const valid = new Set(own.map((c) => c.id));
    const picked = Array.from(new Set((given.choiceIds ?? []).filter((id) => valid.has(id))));
    const correctIds = own.filter((c) => c.is_correct).map((c) => c.id);
    const isCorrect = picked.length === correctIds.length && picked.every((id) => correctIds.includes(id));
    if (isCorrect) score += qu.points;
    rows.push({ attempt_id: attemptId, question_id: qu.id, selected_choice_ids: picked, text_answer: null, is_correct: isCorrect });
  }

  if (rows.length) {
    const { error: aErr } = await service.from("quiz_answers").upsert(rows, { onConflict: "attempt_id,question_id" });
    if (aErr) return { error: "تعذّر حفظ الإجابات" };
  }
  const { error } = await service
    .from("quiz_attempts")
    .update({ submitted_at: new Date().toISOString(), score, needs_review: needsReview })
    .eq("id", attemptId)
    .is("submitted_at", null);
  if (error) return { error: "تعذّر تسليم المحاولة" };

  revalidatePath("/child/quizzes");
  return { ok: true };
}

export async function prepareAnswerUploadAction(
  quizId: string,
  file: FileMeta
): Promise<{ attemptId: string; path: string; token: string } | { error: string }> {
  const me = await currentUser();
  if (!me || me.role !== "member") return { error: "المسابقات للأولاد فقط" };
  const bad = validateFile(file);
  if (bad) return { error: bad };
  const open = await loadOpenQuiz(quizId, me);
  if (open.error !== null) return { error: open.error };
  if (open.quiz.quiz_mode !== "file") return { error: "هذه مسابقة أسئلة وليست رفع ملف" };

  const service = createServiceClient();
  await service.from("quiz_attempts").delete().eq("quiz_id", quizId).eq("user_id", me.user.id).is("submitted_at", null);
  const { data: attempts } = await service.from("quiz_attempts").select("attempt_number").eq("quiz_id", quizId).eq("user_id", me.user.id);
  if ((attempts ?? []).length >= open.quiz.max_attempts) return { error: "استنفدت عدد المحاولات المسموح بها" };

  const nextNumber = Math.max(0, ...(attempts ?? []).map((a) => a.attempt_number)) + 1;
  const { data: created, error } = await service
    .from("quiz_attempts")
    .insert({ quiz_id: quizId, user_id: me.user.id, attempt_number: nextNumber })
    .select("id")
    .single();
  if (error || !created) return { error: "تعذّر تجهيز التسليم" };

  const path = `answers/${quizId}/${me.user.id}/${created.id}/${randomUUID()}.${MIME_EXT[file.type]}`;
  const up = await signedUpload(path);
  if (!up) return { error: "تعذّر تجهيز رفع الملف" };
  return { attemptId: created.id, ...up };
}

export async function finalizeAnswerUploadAction(attemptId: string, path: string, originalName: string): Promise<{ ok: true } | { error: string }> {
  const me = await currentUser();
  if (!me || me.role !== "member") return { error: "غير مصرح" };
  const service = createServiceClient();
  const { data: attempt } = await service.from("quiz_attempts").select("id, quiz_id, submitted_at").eq("id", attemptId).eq("user_id", me.user.id).maybeSingle();
  if (!attempt || attempt.submitted_at) return { error: "المحاولة غير صالحة" };
  if (!path.startsWith(`answers/${attempt.quiz_id}/${me.user.id}/${attemptId}/`)) return { error: "مسار الملف غير صحيح" };

  const info = await objectInfo(path);
  if (!info) return { error: "لم يصل الملف. حاول مرة أخرى." };
  if (!MIME_EXT[info.mimetype] || info.size > MAX_BYTES) {
    await service.storage.from(BUCKET).remove([path]);
    return { error: "نوع أو حجم الملف غير مسموح" };
  }

  const { error } = await service
    .from("quiz_attempts")
    .update({ submitted_at: new Date().toISOString(), answer_file_path: path, answer_file_name: originalName.slice(0, 120), needs_review: true })
    .eq("id", attemptId);
  if (error) return { error: "تعذّر حفظ التسليم" };
  revalidatePath("/child/quizzes");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// روابط التحميل والتصحيح
// ---------------------------------------------------------------------------
export async function getQuizAttachmentUrlAction(quizId: string): Promise<{ url: string } | { error: string }> {
  const me = await currentUser();
  if (!me) return { error: "غير مسجّل الدخول" };
  const { data } = await me.supabase.from("quizzes").select("attachment_path").eq("id", quizId).maybeSingle();
  if (!data?.attachment_path) return { error: "لا يوجد ملف" };
  const url = await signedUrl(data.attachment_path);
  return url ? { url } : { error: "تعذّر إنشاء رابط التحميل" };
}

export async function getAnswerFileUrlAction(attemptId: string): Promise<{ url: string } | { error: string }> {
  const me = await currentUser();
  if (!me) return { error: "غير مسجّل الدخول" };
  const { data } = await me.supabase.from("quiz_attempts").select("answer_file_path").eq("id", attemptId).maybeSingle(); // RLS
  if (!data?.answer_file_path) return { error: "لا يوجد ملف" };
  const url = await signedUrl(data.answer_file_path);
  return url ? { url } : { error: "تعذّر إنشاء رابط التحميل" };
}

export async function gradeAttemptAction(attemptId: string, score: number, feedback: string): Promise<{ error?: string }> {
  const me = await currentUser();
  if (!me || me.role === "member") return { error: "غير مصرح" };
  const { data: attempt } = await me.supabase.from("quiz_attempts").select("id, quiz_id, submitted_at").eq("id", attemptId).maybeSingle(); // RLS: نطاقك فقط
  if (!attempt || !attempt.submitted_at) return { error: "المحاولة غير موجودة أو لم تُسلَّم" };
  const { data: quiz } = await me.supabase.from("quizzes").select("max_score").eq("id", attempt.quiz_id).maybeSingle();
  if (!quiz) return { error: "المسابقة غير موجودة" };
  if (!Number.isFinite(score) || score < 0 || score > Number(quiz.max_score)) return { error: `الدرجة يجب أن تكون بين 0 و${quiz.max_score}` };

  const { error } = await createServiceClient()
    .from("quiz_attempts")
    .update({ score, feedback: feedback.trim().slice(0, 1000) || null, graded_by: me.user.id, graded_at: new Date().toISOString(), needs_review: false })
    .eq("id", attemptId);
  if (error) return { error: "تعذّر حفظ الدرجة" };
  revalidatePath(`/servant/quizzes/${attempt.quiz_id}`);
  revalidatePath(`/admin/quizzes/${attempt.quiz_id}`);
  return {};
}
