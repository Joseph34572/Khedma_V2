import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ManagePanel } from "./ManagePanel";
import { QUESTION_STATUS_LABELS, QUESTION_STATUS_TONE } from "./labels";
import { STAGE_LABELS, STAGE_ORDER, canViewAllStages, type Stage } from "@/lib/roles";
import { relativeArabicDate } from "@/lib/format";
import type { QuestionStatus } from "@/types/database";

async function getMe() {
  const { supabase, user, role } = await getCurrentProfile();
  if (!user || !role) redirect("/login");
  return { supabase, role };
}

const chip = (active: boolean) =>
  `rounded-full px-3.5 py-1.5 text-sm font-medium border ${active ? "bg-primary text-white border-primary" : "border-line text-ink-soft hover:border-primary"}`;

export async function SymposiumListPage({ basePath, searchParams }: { basePath: string; searchParams: { status?: string; stage?: string; q?: string } }) {
  const { supabase, role } = await getMe();
  let query = supabase.from("symposium_inbox").select("*").order("created_at", { ascending: false }).limit(100);
  const status = searchParams.status as QuestionStatus | undefined;
  const stage = searchParams.stage as Stage | undefined;
  if (status && status in QUESTION_STATUS_LABELS) query = query.eq("status", status);
  if (stage && STAGE_ORDER.includes(stage)) query = query.eq("stage_id", stage);
  const term = (searchParams.q ?? "").trim().slice(0, 60).replace(/[%,()]/g, "");
  if (term) query = query.ilike("question_text", `%${term}%`);
  const { data: questions } = await query;

  const href = (o: { status?: string; stage?: string }) => {
    const p = new URLSearchParams();
    const st = "status" in o ? o.status : searchParams.status;
    const sg = "stage" in o ? o.stage : searchParams.stage;
    if (st) p.set("status", st);
    if (sg) p.set("stage", sg);
    if (searchParams.q) p.set("q", searchParams.q);
    const qs = p.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-extrabold text-ink mb-4">صندوق الندوة</h1>
      <form className="mb-3">
        {status && <input type="hidden" name="status" value={status} />}
        {stage && <input type="hidden" name="stage" value={stage} />}
        <input name="q" defaultValue={searchParams.q ?? ""} placeholder="بحث في الأسئلة..." className="w-full rounded-lg border border-line px-4 py-2.5" />
      </form>
      <div className="flex gap-2 flex-wrap mb-3">
        <Link href={href({ status: undefined })} className={chip(!status)}>كل الحالات</Link>
        {(Object.keys(QUESTION_STATUS_LABELS) as QuestionStatus[]).map((s) => (
          <Link key={s} href={href({ status: s })} className={chip(status === s)}>{QUESTION_STATUS_LABELS[s]}</Link>
        ))}
      </div>
      {canViewAllStages(role) && (
        <div className="flex gap-2 flex-wrap mb-4">
          <Link href={href({ stage: undefined })} className={chip(!stage)}>كل المراحل</Link>
          {STAGE_ORDER.map((s) => (
            <Link key={s} href={href({ stage: s })} className={chip(stage === s)}>{STAGE_LABELS[s]}</Link>
          ))}
        </div>
      )}
      <div className="space-y-2">
        {(questions ?? []).map((q) => (
          <Link key={q.id} href={`${basePath}/${q.id}`} className="block bg-white rounded-card border border-line p-4 hover:border-primary">
            <div className="flex items-center justify-between mb-1.5 gap-2">
              <StatusBadge tone={QUESTION_STATUS_TONE[q.status]}>{QUESTION_STATUS_LABELS[q.status]}</StatusBadge>
              <span className="text-xs text-ink-soft">{STAGE_LABELS[q.stage_id]} · {relativeArabicDate(q.created_at)}</span>
            </div>
            <p className="text-sm text-ink line-clamp-2">{q.question_text}</p>
            <p className="text-xs text-ink-soft mt-1.5">
              {q.is_anonymous ? "🕶️ مجهول" : q.asker_name}
              {q.assigned_name ? ` · معيّن لـ ${q.assigned_name}` : ""}
            </p>
          </Link>
        ))}
        {(!questions || questions.length === 0) && <p className="text-ink-soft text-center py-8">لا توجد أسئلة مطابقة.</p>}
      </div>
    </div>
  );
}

export async function SymposiumDetailPage({ questionId, basePath }: { questionId: string; basePath: string }) {
  const { supabase } = await getMe();
  const { data: q } = await supabase.from("symposium_inbox").select("*").eq("id", questionId).maybeSingle();
  if (!q) notFound();
  const [{ data: servants }, { data: notes }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").in("role", ["servant", "stage_secretary"]).eq("stage_id", q.stage_id).eq("status", "active").order("full_name"),
    supabase.from("symposium_notes_view").select("id, note, author_name, created_at").eq("question_id", questionId).order("created_at")
  ]);
  return (
    <div className="max-w-xl">
      <Link href={basePath} className="text-sm text-ink-soft hover:underline">‹ رجوع</Link>
      <div className="bg-white rounded-card border border-line p-5 mt-2 mb-4">
        <p className="text-xs text-ink-soft mb-2">
          {STAGE_LABELS[q.stage_id]} · {relativeArabicDate(q.created_at)} · {q.is_anonymous ? "🕶️ مجهول" : q.asker_name}
        </p>
        <p className="leading-relaxed whitespace-pre-line">{q.question_text}</p>
      </div>
      <ManagePanel questionId={q.id} status={q.status} assignedTo={q.assigned_to} servants={servants ?? []} notes={notes ?? []} />
    </div>
  );
}
