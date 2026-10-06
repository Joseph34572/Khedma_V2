import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { AskForm } from "@/components/symposium/AskForm";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { QUESTION_STATUS_LABELS, QUESTION_STATUS_TONE } from "@/components/symposium/labels";
import { relativeArabicDate } from "@/lib/format";

export default async function ChildSymposiumPage() {
  const { supabase, user } = await getCurrentProfile();
  if (!user) redirect("/login");
  const { data: mine } = await supabase
    .from("symposium_questions")
    .select("id, question_text, status, is_anonymous, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);
  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-extrabold text-ink mb-1">صندوق الندوة</h1>
      <p className="text-ink-soft text-sm mb-5">اسأل عن أي شيء يخص إيمانك أو حياتك، وسيجيب عليك الخدام.</p>
      <AskForm />
      <h2 className="font-bold text-ink mb-3">أسئلتي</h2>
      <div className="space-y-2">
        {(mine ?? []).map((q) => (
          <div key={q.id} className="bg-white rounded-card border border-line p-4">
            <div className="flex items-center justify-between mb-1.5">
              <StatusBadge tone={QUESTION_STATUS_TONE[q.status]}>{QUESTION_STATUS_LABELS[q.status]}</StatusBadge>
              <span className="text-xs text-ink-soft">{q.is_anonymous ? "مجهول · " : ""}{relativeArabicDate(q.created_at)}</span>
            </div>
            <p className="text-sm whitespace-pre-line">{q.question_text}</p>
          </div>
        ))}
        {(!mine || mine.length === 0) && <p className="text-ink-soft text-sm">لم ترسل أي سؤال بعد.</p>}
      </div>
    </div>
  );
}
