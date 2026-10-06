import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { relativeArabicDate } from "@/lib/format";

function statusOf(startsAt: string, endsAt: string): { label: string; tone: "warn" | "good" | "muted" } {
  const now = Date.now();
  if (now < new Date(startsAt).getTime()) return { label: "لم تبدأ بعد", tone: "warn" };
  if (now > new Date(endsAt).getTime()) return { label: "انتهت", tone: "muted" };
  return { label: "جارية الآن", tone: "good" };
}

export default async function ChildQuizzesPage() {
  const { supabase, user } = await getCurrentProfile();
  if (!user) redirect("/login");

  const { data: quizzes } = await supabase.from("quizzes").select("id, title_ar, starts_at, ends_at, quiz_mode").order("starts_at", { ascending: false });
  const { data: myAttempts } = await supabase.from("quiz_attempts").select("quiz_id, submitted_at, score").eq("user_id", user.id);

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-extrabold text-ink mb-5">المسابقات</h1>
      <div className="space-y-2">
        {(quizzes ?? []).map((q) => {
          const st = statusOf(q.starts_at, q.ends_at);
          const mine = (myAttempts ?? []).filter((a) => a.quiz_id === q.id);
          const lastSubmitted = mine.filter((a) => a.submitted_at).length;
          return (
            <Link key={q.id} href={`/child/quizzes/${q.id}`} className="flex items-center justify-between bg-white rounded-card border border-line p-4 hover:border-primary">
              <div>
                <p className="font-bold">{q.title_ar}</p>
                <p className="text-xs text-ink-soft mt-1">
                  {lastSubmitted > 0 ? `تم التسليم (${lastSubmitted} محاولة)` : "لم تحل بعد"}
                </p>
              </div>
              <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
            </Link>
          );
        })}
        {(!quizzes || quizzes.length === 0) && <p className="text-ink-soft text-center py-8">لا توجد مسابقات متاحة الآن.</p>}
      </div>
    </div>
  );
}
