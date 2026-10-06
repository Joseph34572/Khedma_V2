import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { STAGE_LABELS, type Stage } from "@/lib/roles";
import { relativeArabicDate } from "@/lib/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProfileTabs } from "./ProfileTabs";
import { FullHistoryTimeline, type TimelineDay } from "./FullHistoryTimeline";

const COMPLETION_LABEL = { not_started: "لم تبدأ", partial: "جزئي", likely_complete: "يُرجح اكتمالها" } as const;
const ACTIVITY_LABEL = { low: "منخفض", medium: "متوسط", high: "مرتفع" } as const;
const PRAYER_STATUS_LABEL = { in_progress: "جارية", completed: "مكتملة", abandoned: "متروكة" } as const;
const MASS_METHOD_LABEL = { self_report: "تسجيل ذاتي", qr_scan: "مسح QR", manual_by_servant: "تسجيل يدوي من الخادم" } as const;
const SSCHOOL_METHOD_LABEL = { qr_scan: "مسح QR", manual_by_servant: "تسجيل يدوي من الخادم" } as const;

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return "أقل من دقيقة";
  return `${minutes} دقيقة`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" });
}

export async function ChildProfilePage({ childId, basePath }: { childId: string; basePath: string }) {
  const { supabase, user, role } = await getCurrentProfile();
  if (!user || !role) redirect("/login");

  const canSeeConfession = role === "super_admin" || role === "general_secretary";
  const canSeeSymposium = role !== "member";

  const { data: child, error: childError } = await supabase
    .from("profiles")
    .select("full_name, stage_id, status")
    .eq("id", childId)
    .single();

  if (childError || !child) notFound();

  const [prayerRes, readingRes, massAttRes, sschoolAttRes, confessionRes, quizAttemptRes, symposiumRes] = await Promise.all([
    supabase
      .from("prayer_sessions")
      .select("started_at, prayer_content_id, active_seconds, activity_level, completion_level, status")
      .eq("user_id", childId)
      .order("started_at", { ascending: false })
      .limit(30),
    supabase
      .from("bible_reading_sessions")
      .select("started_at, chapter_id, active_seconds, progress_percent, activity_level, completion_level")
      .eq("user_id", childId)
      .order("started_at", { ascending: false })
      .limit(30),
    // ملاحظة مهمة: created_at هنا هو وقت *تسجيل* الحضور وليس تاريخ القداس الفعلي؛
    // لذلك نجلب القداسات بتواريخها الحقيقية في استعلام منفصل أسفل ونرتّب حسبها.
    supabase.from("mass_attendance").select("mass_id, method, created_at").eq("user_id", childId).limit(100),
    supabase.from("sunday_school_attendance").select("session_id, method, recorded_by, recorded_at").eq("user_id", childId).limit(100),
    canSeeConfession
      ? supabase.from("confessions").select("confessed_at").eq("user_id", childId).order("confessed_at", { ascending: false }).limit(20)
      : Promise.resolve({ data: null as null }),
    supabase.from("quiz_attempts").select("quiz_id, attempt_number, started_at, submitted_at, score").eq("user_id", childId).order("started_at", { ascending: false }).limit(30),
    canSeeSymposium
      ? supabase.from("symposium_questions").select("question_text, status, created_at, is_anonymous").eq("user_id", childId).order("created_at", { ascending: false }).limit(30)
      : Promise.resolve({ data: null as null })
  ]);

  // --- الصلاة: جلب أسماء أنواع الصلوات ---
  const prayerContentIds = Array.from(new Set((prayerRes.data ?? []).map((p) => p.prayer_content_id)));
  const { data: prayerContents } = prayerContentIds.length
    ? await supabase.from("prayer_contents").select("id, title_ar").in("id", prayerContentIds)
    : { data: [] as { id: string; title_ar: string }[] };
  const prayerContentMap = new Map((prayerContents ?? []).map((p) => [p.id, p.title_ar]));

  // --- قراءة الكتاب: جلب السفر والإصحاح ---
  const chapterIds = Array.from(new Set((readingRes.data ?? []).map((r) => r.chapter_id)));
  const { data: chapters } = chapterIds.length
    ? await supabase.from("bible_chapters").select("id, chapter_number, book_id").in("id", chapterIds)
    : { data: [] as { id: string; chapter_number: number; book_id: number }[] };
  const bookIds = Array.from(new Set((chapters ?? []).map((c) => c.book_id)));
  const { data: books } = bookIds.length
    ? await supabase.from("bible_books").select("id, name_ar").in("id", bookIds)
    : { data: [] as { id: number; name_ar: string }[] };
  const bookMap = new Map((books ?? []).map((b) => [b.id, b.name_ar]));
  const chapterMap = new Map((chapters ?? []).map((c) => [c.id, { book: bookMap.get(c.book_id) ?? "—", chapter: c.chapter_number }]));

  // --- القداسات: التاريخ الحقيقي للقداس وليس وقت التسجيل ---
  const massIds = Array.from(new Set((massAttRes.data ?? []).map((m) => m.mass_id)));
  const { data: masses } = massIds.length
    ? await supabase.from("masses").select("id, title_ar, mass_date").in("id", massIds)
    : { data: [] as { id: string; title_ar: string; mass_date: string }[] };
  const massMap = new Map((masses ?? []).map((m) => [m.id, m]));
  const massHistory = (massAttRes.data ?? [])
    .map((a) => ({ ...a, mass: massMap.get(a.mass_id) }))
    .filter((a) => a.mass)
    .sort((a, b) => (a.mass!.mass_date < b.mass!.mass_date ? 1 : -1));

  // --- مدارس الأحد: تاريخ الجلسة الحقيقي + اسم من سجّل الحضور ---
  const sessionIds = Array.from(new Set((sschoolAttRes.data ?? []).map((s) => s.session_id)));
  const { data: sessions } = sessionIds.length
    ? await supabase.from("sunday_school_sessions").select("id, session_date, stage_id").in("id", sessionIds)
    : { data: [] as { id: string; session_date: string; stage_id: Stage }[] };
  const sessionMap = new Map((sessions ?? []).map((s) => [s.id, s]));
  const recorderIds = Array.from(new Set((sschoolAttRes.data ?? []).map((s) => s.recorded_by).filter(Boolean))) as string[];
  const { data: recorders } = recorderIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", recorderIds)
    : { data: [] as { id: string; full_name: string }[] };
  const recorderMap = new Map((recorders ?? []).map((r) => [r.id, r.full_name]));
  const sschoolHistory = (sschoolAttRes.data ?? [])
    .map((s) => ({ ...s, session: sessionMap.get(s.session_id) }))
    .filter((s) => s.session)
    .sort((a, b) => (a.session!.session_date < b.session!.session_date ? 1 : -1));

  // --- المسابقات: اسم المسابقة ---
  const quizIds = Array.from(new Set((quizAttemptRes.data ?? []).map((q) => q.quiz_id)));
  const { data: quizzes } = quizIds.length
    ? await supabase.from("quizzes").select("id, title_ar").in("id", quizIds)
    : { data: [] as { id: string; title_ar: string }[] };
  const quizMap = new Map((quizzes ?? []).map((q) => [q.id, q.title_ar]));

  // --- بناء التاريخ الكامل (Timeline) ---
  const dayMap = new Map<string, TimelineDay>();
  function dayKey(iso: string) {
    return new Date(iso).toISOString().slice(0, 10);
  }
  function getDay(iso: string): TimelineDay {
    const key = dayKey(iso);
    if (!dayMap.has(key)) dayMap.set(key, { date: key, items: [] });
    return dayMap.get(key)!;
  }
  for (const p of prayerRes.data ?? []) {
    getDay(p.started_at).items.push({ ok: p.completion_level !== "not_started", label: "صلاة" });
  }
  for (const r of readingRes.data ?? []) {
    getDay(r.started_at).items.push({ ok: r.completion_level !== "not_started", label: "قراءة الكتاب" });
  }
  for (const m of massHistory) {
    getDay(m.mass!.mass_date).items.push({ ok: true, label: "حضور قداس" });
  }
  for (const s of sschoolHistory) {
    getDay(s.session!.session_date).items.push({ ok: true, label: "حضور مدارس الأحد" });
  }
  const timelineDays = Array.from(dayMap.values()).sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="max-w-3xl">
      <div className="mb-6 bg-white rounded-card border border-line p-5 flex items-center justify-between flex-wrap gap-3">
        <div>
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
        <Link href={basePath} className="text-sm text-ink-soft hover:underline">‹ رجوع للجدول</Link>
      </div>

      <ProfileTabs
        sections={[
          {
            key: "prayer",
            label: "تاريخ الصلاة",
            content:
              prayerRes.data && prayerRes.data.length > 0 ? (
                <ul className="divide-y divide-line">
                  {prayerRes.data.map((s, i) => (
                    <li key={i} className="py-2.5 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{prayerContentMap.get(s.prayer_content_id) ?? "—"}</span>
                        <span className="text-ink-soft">{relativeArabicDate(s.started_at)}</span>
                      </div>
                      <p className="text-ink-soft mt-0.5">
                        المدة: {formatDuration(s.active_seconds)} · النشاط: {s.activity_level ? ACTIVITY_LABEL[s.activity_level] : "—"} · الإكمال: {COMPLETION_LABEL[s.completion_level]} · الحالة: {PRAYER_STATUS_LABEL[s.status]}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty text="لا توجد جلسات صلاة مسجّلة بعد." />
              )
          },
          {
            key: "bible",
            label: "قراءة الكتاب المقدس",
            content:
              readingRes.data && readingRes.data.length > 0 ? (
                <ul className="divide-y divide-line">
                  {readingRes.data.map((s, i) => {
                    const ch = chapterMap.get(s.chapter_id);
                    return (
                      <li key={i} className="py-2.5 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-bold">{ch ? `${ch.book} ${ch.chapter}` : "—"}</span>
                          <span className="text-ink-soft">{relativeArabicDate(s.started_at)}</span>
                        </div>
                        <p className="text-ink-soft mt-0.5">
                          المدة: {formatDuration(s.active_seconds)} · نسبة الإكمال: {s.progress_percent}% · النشاط: {s.activity_level ? ACTIVITY_LABEL[s.activity_level] : "—"}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <Empty text="لا توجد جلسات قراءة مسجّلة بعد." />
              )
          },
          {
            key: "mass",
            label: "حضور القداسات",
            content:
              massHistory.length > 0 ? (
                <ul className="divide-y divide-line">
                  {massHistory.map((m, i) => (
                    <li key={i} className="py-2.5 flex items-center justify-between text-sm">
                      <span className="font-bold">{m.mass!.title_ar} — {formatDate(m.mass!.mass_date)}</span>
                      <span className="text-ink-soft">{MASS_METHOD_LABEL[m.method]}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty text="لا يوجد حضور قداس مسجّل بعد." />
              )
          },
          {
            key: "confession",
            label: "تاريخ الاعتراف",
            content: canSeeConfession ? (
              confessionRes.data && confessionRes.data.length > 0 ? (
                <ul className="divide-y divide-line">
                  {confessionRes.data.map((c: { confessed_at: string }, i: number) => (
                    <li key={i} className="py-2.5 text-sm">{formatDate(c.confessed_at)}</li>
                  ))}
                </ul>
              ) : (
                <Empty text="لا يوجد اعتراف مسجّل بعد." />
              )
            ) : (
              <p className="text-sm text-ink-soft">🔒 هذه البيانات مقيّدة ومتاحة للأمناء العامين فقط.</p>
            )
          },
          {
            key: "sschool",
            label: "حضور مدارس الأحد",
            content:
              sschoolHistory.length > 0 ? (
                <ul className="divide-y divide-line">
                  {sschoolHistory.map((s, i) => (
                    <li key={i} className="py-2.5 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{formatDate(s.session!.session_date)}</span>
                        <span className="text-ink-soft">{SSCHOOL_METHOD_LABEL[s.method]}</span>
                      </div>
                      <p className="text-ink-soft mt-0.5">
                        وقت التسجيل: {new Date(s.recorded_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                        {" · "}بواسطة: {s.recorded_by ? recorderMap.get(s.recorded_by) ?? "—" : "تسجيل ذاتي (QR)"}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty text="لا يوجد حضور مدارس أحد مسجّل بعد." />
              )
          },
          {
            key: "quizzes",
            label: "المسابقات",
            content:
              quizAttemptRes.data && quizAttemptRes.data.length > 0 ? (
                <ul className="divide-y divide-line">
                  {quizAttemptRes.data.map((q, i) => (
                    <li key={i} className="py-2.5 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{quizMap.get(q.quiz_id) ?? "—"}</span>
                        <span className="text-ink-soft">{q.submitted_at ? relativeArabicDate(q.submitted_at) : "لم يُسلَّم بعد"}</span>
                      </div>
                      <p className="text-ink-soft mt-0.5">
                        المحاولة رقم {q.attempt_number} · الدرجة: {q.score ?? "—"} · المدة: {q.submitted_at ? formatDuration((new Date(q.submitted_at).getTime() - new Date(q.started_at).getTime()) / 1000) : "—"}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty text="لم يحل أي مسابقة بعد." />
              )
          },
          {
            key: "symposium",
            label: "صندوق الندوة",
            content: canSeeSymposium ? (
              symposiumRes.data && symposiumRes.data.length > 0 ? (
                <ul className="divide-y divide-line">
                  {symposiumRes.data.map((q: { question_text: string; status: string; created_at: string }, i: number) => (
                    <li key={i} className="py-2.5 text-sm">
                      <div className="flex items-center justify-between">
                        <span>{q.question_text}</span>
                        <span className="text-ink-soft">{relativeArabicDate(q.created_at)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty text="لم يرسل أي سؤال بعد." />
              )
            ) : (
              <p className="text-sm text-ink-soft">🔒 هذه البيانات غير متاحة لصلاحيتك.</p>
            )
          },
          {
            key: "timeline",
            label: "التاريخ الكامل",
            content: <FullHistoryTimeline days={timelineDays} />
          }
        ]}
      />
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-ink-soft">{text}</p>;
}
