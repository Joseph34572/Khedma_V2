import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { startQuizAttemptAction } from "@/lib/actions/quizzes";
import { SolveQuiz } from "@/components/quizzes/SolveQuiz";
import { FileSubmit } from "@/components/quizzes/FileSubmit";
import { DownloadButton } from "@/components/quizzes/DownloadButton";
import { relativeArabicDate } from "@/lib/format";

export default async function ChildQuizPage({ params }: { params: { quizId: string } }) {
  const { supabase, user } = await getCurrentProfile();
  if (!user) redirect("/login");

  const { data: quiz } = await supabase.from("quizzes").select("*").eq("id", params.quizId).maybeSingle();
  if (!quiz) notFound();

  const now = Date.now();
  const started = now >= new Date(quiz.starts_at).getTime();
  const ended = now > new Date(quiz.ends_at).getTime();

  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("id, attempt_number, submitted_at, score, needs_review, feedback")
    .eq("quiz_id", quiz.id)
    .eq("user_id", user.id)
    .order("attempt_number", { ascending: false });

  const submittedAttempts = (attempts ?? []).filter((a) => a.submitted_at);
  const attemptsLeft = quiz.max_attempts - submittedAttempts.length;

  if (!started) {
    return <Info title={quiz.title_ar} text={`تبدأ هذه المسابقة في ${relativeArabicDate(quiz.starts_at)}.`} />;
  }
  if (ended || attemptsLeft <= 0) {
    return (
      <div className="max-w-xl">
        <h1 className="text-xl font-extrabold text-ink mb-4">{quiz.title_ar}</h1>
        <AttemptsList attempts={submittedAttempts} maxScore={Number(quiz.max_score)} />
        {ended ? <Info title="" text="انتهى وقت هذه المسابقة." /> : <Info title="" text="استنفدت عدد المحاولات المسموح بها." />}
      </div>
    );
  }

  if (quiz.quiz_mode === "file") {
    return (
      <div className="max-w-xl">
        <h1 className="text-xl font-extrabold text-ink mb-1">{quiz.title_ar}</h1>
        <p className="text-ink-soft text-sm mb-4">محاولات متبقية: {attemptsLeft}</p>
        <div className="mb-4"><DownloadButton kind="attachment" id={quiz.id} label={quiz.attachment_name ?? "تحميل ملف المسابقة"} /></div>
        <FileSubmit quizId={quiz.id} basePath="/child/quizzes" />
        <div className="mt-6"><AttemptsList attempts={submittedAttempts} maxScore={Number(quiz.max_score)} /></div>
      </div>
    );
  }

  const started_result = await startQuizAttemptAction(quiz.id);
  if ("error" in started_result) {
    return (
      <div className="max-w-xl">
        <h1 className="text-xl font-extrabold text-ink mb-4">{quiz.title_ar}</h1>
        <Info title="" text={started_result.error} />
        <div className="mt-6"><AttemptsList attempts={submittedAttempts} maxScore={Number(quiz.max_score)} /></div>
      </div>
    );
  }

  const service = createServiceClient();
  const { data: attempt } = await service.from("quiz_attempts").select("started_at").eq("id", started_result.attemptId).single();
  const { data: questions } = await service.from("quiz_questions").select("id, question_type, prompt, points, sort_order").eq("quiz_id", quiz.id).order("sort_order");
  const qIds = (questions ?? []).map((q) => q.id);
  const { data: choicesRaw } = qIds.length
    ? await service.from("quiz_question_choices").select("id, question_id, choice_text, sort_order").in("question_id", qIds).order("sort_order")
    : { data: [] };

  const fullQuestions = (questions ?? []).map((q) => ({
    ...q,
    choices: (choicesRaw ?? []).filter((c) => c.question_id === q.id).map((c) => ({ id: c.id, choice_text: c.choice_text }))
  }));

  const endsAtMs = new Date(attempt!.started_at).getTime() + quiz.duration_seconds * 1000;

  return (
    <div>
      <h1 className="text-xl font-extrabold text-ink mb-4">{quiz.title_ar}</h1>
      <SolveQuiz attemptId={started_result.attemptId} endsAtMs={endsAtMs} questions={fullQuestions} basePath="/child/quizzes" />
    </div>
  );
}

function Info({ title, text }: { title: string; text: string }) {
  return (
    <div className="bg-white rounded-card border border-line p-6 text-center">
      {title && <p className="font-bold mb-1">{title}</p>}
      <p className="text-ink-soft">{text}</p>
    </div>
  );
}

function AttemptsList({ attempts, maxScore }: { attempts: { id: string; attempt_number: number; score: number | null; needs_review: boolean; feedback: string | null }[]; maxScore: number }) {
  if (attempts.length === 0) return null;
  return (
    <div className="space-y-2">
      <h2 className="font-bold text-ink">محاولاتك</h2>
      {attempts.map((a) => (
        <div key={a.id} className="bg-white rounded-card border border-line p-4 text-sm">
          <p>محاولة {a.attempt_number}: {a.needs_review ? "قيد المراجعة" : `${a.score ?? 0} / ${maxScore}`}</p>
          {a.feedback && <p className="text-ink-soft mt-1">ملاحظة الخادم: {a.feedback}</p>}
        </div>
      ))}
    </div>
  );
}
