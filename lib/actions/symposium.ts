"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { QuestionStatus } from "@/types/database";

export type ActionState = { error: string | null; success: string | null };
const STATUSES: QuestionStatus[] = ["new", "reviewed", "discussed", "archived"];

export async function submitQuestionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل الدخول", success: null };

  const text = String(formData.get("question_text") ?? "").trim();
  const anonymous = formData.get("is_anonymous") === "on";
  if (text.length < 5) return { error: "اكتب سؤالك بشكل أوضح (5 أحرف على الأقل).", success: null };
  if (text.length > 1500) return { error: "السؤال طويل جدًا (الحد الأقصى 1500 حرف).", success: null };

  const { error } = await supabase.from("symposium_questions").insert({ user_id: user.id, question_text: text, is_anonymous: anonymous });
  if (error) return { error: "تعذّر إرسال السؤال. حاول مرة أخرى.", success: null };

  revalidatePath("/child/symposium");
  return { error: null, success: "تم إرسال سؤالك بنجاح." };
}

export async function setQuestionStatusAction(questionId: string, status: string): Promise<{ error?: string }> {
  if (!STATUSES.includes(status as QuestionStatus)) return { error: "حالة غير صحيحة" };
  const supabase = createClient();
  const { error } = await supabase.rpc("symposium_set_status", { q: questionId, s: status as QuestionStatus });
  if (error) return { error: "تعذّر تغيير الحالة" };
  revalidatePath("/servant/symposium");
  revalidatePath("/admin/symposium");
  return {};
}

export async function assignQuestionAction(questionId: string, servantId: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { error } = await supabase.rpc("symposium_assign", { q: questionId, a: servantId || null });
  if (error) return { error: "تعذّر تعيين السؤال" };
  revalidatePath("/servant/symposium");
  revalidatePath("/admin/symposium");
  return {};
}

export async function addQuestionNoteAction(questionId: string, note: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل الدخول" };
  const clean = note.trim();
  if (!clean) return { error: "اكتب الملاحظة أولًا" };
  if (clean.length > 1500) return { error: "الملاحظة طويلة جدًا" };
  const { error } = await supabase.from("symposium_question_notes").insert({ question_id: questionId, author_id: user.id, note: clean });
  if (error) return { error: "تعذّر حفظ الملاحظة" };
  revalidatePath("/servant/symposium");
  revalidatePath("/admin/symposium");
  return {};
}
