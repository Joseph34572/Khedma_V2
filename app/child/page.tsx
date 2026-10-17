import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { relativeArabicDate } from "@/lib/format";
import { Icon } from "@/components/ui/Icon";
import { Tile, WideTile, Done, Pending, Muted, ProgressRing } from "@/components/home/Tiles";

type NotificationRow = { id: string; notifications: { title: string; sent_at: string | null } | null };

export default async function ChildHomePage() {
  const { supabase, user } = await getCurrentProfile();
  if (!user) redirect("/login");

  const nowIso = new Date().toISOString();

  const [
    { data: lastPrayer },
    { data: lastReading },
    { data: lastConfession },
    { data: lastSunday },
    { data: openQuizzes },
    { data: myAttempts },
    { data: unread }
  ] = await Promise.all([
    supabase
      .from("prayer_sessions")
      .select("started_at, completion_level")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("bible_reading_sessions")
      .select("started_at, completion_level")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("confessions")
      .select("confessed_at")
      .eq("user_id", user.id)
      .order("confessed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("sunday_school_attendance")
      .select("recorded_at, sunday_school_sessions(session_date)")
      .eq("user_id", user.id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // المسابقات المفتوحة دلوقتي (RLS بيقصرها على مرحلة الولد).
    supabase
      .from("quizzes")
      .select("id, title_ar, ends_at, max_attempts")
      .lte("starts_at", nowIso)
      .gte("ends_at", nowIso)
      .order("ends_at", { ascending: true }),
    supabase.from("quiz_attempts").select("quiz_id, submitted_at").eq("user_id", user.id),
    // الإشعارات اللي لسه متقرتش — أول ما الولد يقرأها الكارت بيختفي.
    supabase
      .from("notification_recipients")
      .select("id, notifications(title, sent_at)")
      .eq("user_id", user.id)
      .is("read_at", null)
      .limit(50)
  ]);

  const today = new Date().toDateString();
  const isToday = (value: string | undefined) => !!value && new Date(value).toDateString() === today;
  const prayedToday = isToday(lastPrayer?.started_at) && lastPrayer?.completion_level === "likely_complete";
  const readToday = isToday(lastReading?.started_at) && lastReading?.completion_level === "likely_complete";

  // تاريخ حصة مدارس الأحد نفسها لو متاح؛ الولد مالوش صلاحية قراءة جدول الحصص (RLS)،
  // فوقتها بنرجع لوقت تسجيل الحضور.
  const sundaySession = lastSunday?.sunday_school_sessions as unknown as { session_date: string } | null | undefined;
  const lastSundayDate = sundaySession?.session_date ?? lastSunday?.recorded_at ?? null;

  // مسابقة تظهر بس لو مفتوحة الآن والولد لسه عنده محاولات.
  const submittedByQuiz = new Map<string, number>();
  for (const a of myAttempts ?? []) {
    if (a.submitted_at) submittedByQuiz.set(a.quiz_id, (submittedByQuiz.get(a.quiz_id) ?? 0) + 1);
  }
  const availableQuizzes = (openQuizzes ?? []).filter((q) => (submittedByQuiz.get(q.id) ?? 0) < (q.max_attempts ?? 1));

  const firstQuiz = availableQuizzes[0];

  const unreadItems = ((unread ?? []) as unknown as NotificationRow[]).filter((r) => r.notifications);
  const latestUnread = unreadItems.sort((a, b) =>
    (b.notifications?.sent_at ?? "").localeCompare(a.notifications?.sent_at ?? "")
  )[0];

  const done = Number(prayedToday) + Number(readToday);
  const total = 2;
  const ar = (n: number) => n.toLocaleString("ar-EG");

  const headline = done === total ? "برافو! خلّصت مهام النهارده" : done > 0 ? "قربت تخلّص!" : "يلا نبدأ اليوم";
  const subline =
    done === total
      ? "صلّيت وقريت الإصحاح، ربنا يباركك"
      : !prayedToday && !readToday
        ? "صلاة النهارده وقراية الإصحاح مستنيينك"
        : !prayedToday
          ? "فاضلك صلاة النهارده"
          : "فاضلك قراءة الإصحاح";

  return (
    <div className="max-w-xl mx-auto grid grid-cols-2 gap-3">
      <section className="col-span-2 bg-white rounded-[24px] border-2 border-line p-4 flex items-center gap-4 shadow-[0_6px_0_#ECDFC8]">
        <ProgressRing done={done} total={total} />
        <div className="min-w-0">
          <h1 className="text-[17px] font-extrabold text-ink">{headline}</h1>
          <p className="text-sm text-ink-soft leading-relaxed mt-1">{subline}</p>
        </div>
      </section>

      <Tile href="/child/prayer" label="الصلاة" icon="cross">
        {prayedToday ? <Done>مكتملة النهارده</Done> : <Pending>لم تكتمل بعد</Pending>}
      </Tile>
      <Tile href="/child/bible" label="الكتاب المقدس" icon="book">
        {readToday ? <Done>قريت النهارده</Done> : <Pending>لم يكتمل بعد</Pending>}
      </Tile>
      <Tile href="/child/mass" label="مدارس الأحد" icon="users">
        <Muted>{lastSundayDate ? `آخر حضور: ${relativeArabicDate(lastSundayDate)}` : "لم يسجّل بعد"}</Muted>
      </Tile>
      <Tile label="الاعتراف" icon="heart">
        <Muted>{lastConfession ? `آخر اعتراف: ${relativeArabicDate(lastConfession.confessed_at)}` : "لم يسجّل بعد"}</Muted>
      </Tile>

      {firstQuiz && (
        <WideTile
          href={availableQuizzes.length === 1 ? `/child/quizzes/${firstQuiz.id}` : "/child/quizzes"}
          icon="trophy"
          chipClass="bg-gold text-primary-dark"
          title={availableQuizzes.length === 1 ? "مسابقة مستنياك!" : `${ar(availableQuizzes.length)} مسابقات مستنياك!`}
          subtitle={`${firstQuiz.title_ar} · تنتهي ${relativeArabicDate(firstQuiz.ends_at)}`}
        />
      )}

      {latestUnread && (
        <WideTile
          href="/child/notifications"
          icon="bell"
          chipClass="bg-primary text-parchment"
          title={unreadItems.length === 1 ? "إشعار جديد" : `${ar(unreadItems.length)} إشعارات جديدة`}
          subtitle={latestUnread.notifications?.title ?? ""}
          badge={ar(unreadItems.length)}
        />
      )}

      <Link
        href="/child/symposium"
        prefetch={false}
        className="col-span-2 h-[56px] rounded-[18px] bg-primary text-parchment text-base font-extrabold flex items-center justify-center gap-2 mt-1.5"
      >
        <Icon name="chat" size={20} />
        اسأل سؤال في صندوق الندوة
      </Link>
    </div>
  );
}
