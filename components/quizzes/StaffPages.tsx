import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { QuizBuilder } from "./QuizBuilder";
import { GradeForm } from "./GradeForm";
import { DeleteQuizButton } from "./DeleteQuizButton";
import { DownloadButton } from "./DownloadButton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { STAGE_LABELS, STAGE_ORDER, canViewAllStages, type Stage } from "@/lib/roles";
import { relativeArabicDate } from "@/lib/format";

async function getMe() {
  const { supabase, user, role, stageId } = await getCurrentProfile();
  if (!user || !role) redirect("/login");
  return { supabase, user, role, stageId };
}

function statusOf(startsAt: string, endsAt: string): { label: string; tone: "warn" | "good" | "muted" } {
  const now = Date.now();
  if (now < new Date(startsAt).getTime()) return { label: "لم تبدأ بعد", tone: "warn" };
  if (now > new Date(endsAt).getTime()) return { label: "انتهت", tone: "muted" };
  return { label: "جارية الآن", tone: "good" };
}

export async function QuizListPage({ basePath }: { basePath: string }) {
  const { supabase, role, stageId } = await getMe();
  const { data: quizzes } = await supabase.from("quizzes").select("id, title_ar, stage_id, starts_at, ends_at, quiz_mode").order("created_at", { ascending: false });

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-extrabold text-ink">المسابقات</h1>
        <Link href={`${basePath}/new`} className="rounded-lg bg-primary text-white px-4 py-2 text-sm font-bold">+ مسابقة جديدة</Link>
      </div>
      <div className="space-y-2">
        {(quizzes ?? []).map((q) => {
          const st = statusOf(q.starts_at, q.ends_at);
          return (
            <Link key={q.id} href={`${basePath}/${q.id}`} className="flex items-center justify-between bg-white rounded-card border border-line p-4 hover:border-primary">
              <div>
                <p className="font-bold">{q.title_ar}</p>
                <p className="text-xs text-ink-soft mt-1">{q.stage_id ? STAGE_LABELS[q.stage_id] : "كل المراحل"} · {q.quiz_mode === "file" ? "ملف" : "أسئلة"}</p>
              </div>
              <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
            </Link>
          );
        })}
        {(!quizzes || quizzes.length === 0) && <p className="text-ink-soft text-center py-8">لا توجد مسابقات بعد.</p>}
      </div>
    </div>
  );
}

export async function QuizNewPage({ basePath }: { basePath: string }) {
  const { role, stageId } = await getMe();
  const stages: Stage[] = canViewAllStages(role) ? STAGE_ORDER : stageId ? [stageId] : [];
  if (stages.length === 0) redirect(basePath);
  return (
    <div>
      <Link href={basePath} className="text-sm text-ink-soft hover:underline">‹ رجوع للمسابقات</Link>
      <h1 className="text-xl font-extrabold text-ink mt-2 mb-5">مسابقة جديدة</h1>
      <QuizBuilder stages={stages} basePath={basePath} />
    </div>
  );
}

export async function QuizDetailPage({ quizId, basePath }: { quizId: string; basePath: string }) {
  const { supabase, user } = await getMe();
  const { data: quiz } = await supabase.from("quizzes").select("*").eq("id", quizId).maybeSingle();
  if (!quiz) notFound();

  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("id, user_id, attempt_number, submitted_at, score, needs_review, answer_file_path, answer_file_name")
    .eq("quiz_id", quizId)
    .order("submitted_at", { ascending: false, nullsFirst: true });

  const userIds = Array.from(new Set((attempts ?? []).map((a) => a.user_id)));
  const { data: users } = userIds.length ? await supabase.from("profiles").select("id, full_name").in("id", userIds) : { data: [] };
  const nameOf = (id: string) => users?.find((u) => u.id === id)?.full_name ?? "—";

  const st = statusOf(quiz.starts_at, quiz.ends_at);
  const submitted = (attempts ?? []).filter((a) => a.submitted_at);

  return (
    <div className="max-w-2xl">
      <Link href={basePath} className="text-sm text-ink-soft hover:underline">‹ رجوع للمسابقات</Link>
      <div className="flex items-center justify-between mt-2 mb-1">
        <h1 className="text-xl font-extrabold text-ink">{quiz.title_ar}</h1>
        <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
      </div>
      <p className="text-ink-soft text-sm mb-1">
        {quiz.stage_id ? STAGE_LABELS[quiz.stage_id] : "كل المراحل"} · من {relativeArabicDate(quiz.starts_at)} إلى {relativeArabicDate(quiz.ends_at)} · محاولات مسموحة: {quiz.max_attempts}
      </p>
      <div className="mb-5">
        {quiz.quiz_mode === "file" ? <DownloadButton kind="attachment" id={quiz.id} label={quiz.attachment_name ?? "ملف المسابقة"} /> : null}
        <span className="ms-3"><DeleteQuizButton quizId={quiz.id} backHref={basePath} /></span>
      </div>

      <h2 className="font-bold text-ink mb-3">المحاولات ({submitted.length})</h2>
      <div className="space-y-2">
        {submitted.map((a) => (
          <div key={a.id} className="bg-white rounded-card border border-line p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold">{nameOf(a.user_id)}</span>
              <span className="text-xs text-ink-soft">محاولة {a.attempt_number} · {relativeArabicDate(a.submitted_at)}</span>
            </div>
            {a.answer_file_path && <div className="mb-2"><DownloadButton kind="answer" id={a.id} label={a.answer_file_name ?? "ملف الحل"} /></div>}
            {a.needs_review || quiz.quiz_mode === "file" ? (
              <GradeForm attemptId={a.id} maxScore={Number(quiz.max_score)} score={a.score} feedback={null} />
            ) : (
              <p className="text-sm text-ink-soft">الدرجة: {a.score ?? 0} / {quiz.max_score}</p>
            )}
          </div>
        ))}
        {submitted.length === 0 && <p className="text-ink-soft text-sm">لا توجد محاولات مُسلَّمة بعد.</p>}
      </div>
    </div>
  );
}
