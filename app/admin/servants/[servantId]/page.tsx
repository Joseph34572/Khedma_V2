import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { STAGE_LABELS, canViewAllStages, type Stage } from "@/lib/roles";
import { relativeArabicDate } from "@/lib/format";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default async function ChildProfilePage({ params }: { params: { servantId: string } }) {
  const { supabase, user, role } = await getCurrentProfile();
  if (!user) redirect("/login");

  const canSeeConfession = !!role && canViewAllStages(role);

  const { data: child, error: childError } = await supabase
    .from("profiles")
    .select("full_name, stage_id, status")
    .eq("id", params.servantId)
    .single();

  if (childError || !child) notFound();

  const [prayerRes, readingRes, massRes, sundaySchoolRes, confessionRes] = await Promise.all([
    supabase
      .from("prayer_sessions")
      .select("started_at, completion_level, activity_level, progress_percent")
      .eq("user_id", params.servantId)
      .order("started_at", { ascending: false })
      .limit(10),
    supabase
      .from("bible_reading_sessions")
      .select("started_at, completion_level, activity_level, progress_percent")
      .eq("user_id", params.servantId)
      .order("started_at", { ascending: false })
      .limit(10),
    supabase
      .from("mass_attendance")
      .select("created_at, method")
      .eq("user_id", params.servantId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("sunday_school_attendance")
      .select("recorded_at, method")
      .eq("user_id", params.servantId)
      .order("recorded_at", { ascending: false })
      .limit(10),
    canSeeConfession
      ? supabase
          .from("confessions")
          .select("confessed_at")
          .eq("user_id", params.servantId)
          .order("confessed_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: null })
  ]);

  const completionLabel = { not_started: "لم تبدأ", partial: "جزئي", likely_complete: "يُرجح اكتمالها" } as const;
  const activityLabel = { low: "منخفض", medium: "متوسط", high: "مرتفع" } as const;

  return (
    <div className="max-w-3xl">
      <div className="mb-6 bg-white rounded-card border border-line p-5">
        <h1 className="text-xl font-extrabold text-ink">{child.full_name}</h1>
        <p className="text-ink-soft mt-1">{STAGE_LABELS[child.stage_id as Stage]}</p>
        <div className="mt-2">
          {child.status === "active" ? (
            <StatusBadge tone="good">✅ حساب نشط</StatusBadge>
          ) : (
            <StatusBadge tone="bad">🔴 حساب معطّل</StatusBadge>
          )}
        </div>
      </div>

      <Section title="تاريخ الصلاة">
        {prayerRes.data && prayerRes.data.length > 0 ? (
          <ul className="divide-y divide-line">
            {prayerRes.data.map((s, i) => (
              <li key={i} className="py-2.5 flex items-center justify-between text-sm">
                <span>{relativeArabicDate(s.started_at)}</span>
                <span className="text-ink-soft">
                  الإكمال: {completionLabel[s.completion_level]} · النشاط: {s.activity_level ? activityLabel[s.activity_level] : "—"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty text="لا توجد جلسات صلاة مسجّلة بعد." />
        )}
      </Section>

      <Section title="تاريخ قراءة الكتاب المقدس">
        {readingRes.data && readingRes.data.length > 0 ? (
          <ul className="divide-y divide-line">
            {readingRes.data.map((s, i) => (
              <li key={i} className="py-2.5 flex items-center justify-between text-sm">
                <span>{relativeArabicDate(s.started_at)}</span>
                <span className="text-ink-soft">
                  الإكمال: {completionLabel[s.completion_level]} · النشاط: {s.activity_level ? activityLabel[s.activity_level] : "—"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty text="لا توجد جلسات قراءة مسجّلة بعد." />
        )}
      </Section>

      <Section title="تاريخ حضور القداسات">
        {massRes.data && massRes.data.length > 0 ? (
          <ul className="divide-y divide-line">
            {massRes.data.map((m, i) => (
              <li key={i} className="py-2.5 text-sm">{relativeArabicDate(m.created_at)}</li>
            ))}
          </ul>
        ) : (
          <Empty text="لا يوجد حضور قداس مسجّل بعد." />
        )}
      </Section>

      <Section title="تاريخ حضور مدارس الأحد">
        {sundaySchoolRes.data && sundaySchoolRes.data.length > 0 ? (
          <ul className="divide-y divide-line">
            {sundaySchoolRes.data.map((s, i) => (
              <li key={i} className="py-2.5 text-sm">{relativeArabicDate(s.recorded_at)}</li>
            ))}
          </ul>
        ) : (
          <Empty text="لا يوجد حضور مدارس أحد مسجّل بعد." />
        )}
      </Section>

      {canSeeConfession ? (
        <Section title="تاريخ الاعتراف">
          {confessionRes.data && confessionRes.data.length > 0 ? (
            <ul className="divide-y divide-line">
              {confessionRes.data.map((c: { confessed_at: string }, i: number) => (
                <li key={i} className="py-2.5 text-sm">{relativeArabicDate(c.confessed_at)}</li>
              ))}
            </ul>
          ) : (
            <Empty text="لا يوجد اعتراف مسجّل بعد." />
          )}
        </Section>
      ) : (
        <Section title="تاريخ الاعتراف">
          <p className="text-sm text-ink-soft">🔒 هذه البيانات مقيّدة ومتاحة للأمناء العامين فقط.</p>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 bg-white rounded-card border border-line p-5">
      <h2 className="font-bold text-ink mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-ink-soft">{text}</p>;
}
