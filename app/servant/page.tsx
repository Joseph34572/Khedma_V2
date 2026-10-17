import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { toChildRow } from "@/lib/childRow";
import { relativeArabicDate } from "@/lib/format";
import { TodayAttendanceButtons } from "@/components/home/TodayAttendanceButtons";
import { Tile, WideTile, Pending, Muted, ProgressRing } from "@/components/home/Tiles";

type NotificationRow = { id: string; notifications: { title: string; sent_at: string | null } | null };

const ar = (n: number) => n.toLocaleString("ar-EG");

export default async function ServantHomePage() {
  const { supabase, user } = await getCurrentProfile();
  if (!user) redirect("/login");

  const [{ data: summary }, { count: newQuestions }, { count: needsReview }, { data: unread }] = await Promise.all([
    // RLS بيقصر الأولاد على مرحلة الخادم.
    supabase.from("child_activity_summary").select("*"),
    supabase.from("symposium_inbox").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase
      .from("quiz_attempts")
      .select("id", { count: "exact", head: true })
      .eq("needs_review", true)
      .not("submitted_at", "is", null),
    supabase
      .from("notification_recipients")
      .select("id, notifications(title, sent_at)")
      .eq("user_id", user.id)
      .is("read_at", null)
      .limit(50)
  ]);

  const rows = (summary ?? []).map(toChildRow);
  const total = rows.length;
  const prayedToday = rows.filter((r) => r.today_prayer_status === "completed").length;
  const readToday = rows.filter((r) => r.today_reading_status === "completed").length;

  const sevenDaysAgo = Date.now() - 7 * 86_400_000;
  const massLast7 = rows.filter((r) => r.last_mass_date && new Date(r.last_mass_date).getTime() >= sevenDaysAgo).length;

  const sundayDates = rows.map((r) => r.last_sunday_school_date).filter((d): d is string => !!d).sort();
  const lastSundayDate = sundayDates[sundayDates.length - 1] ?? null;
  const lastSundayCount = lastSundayDate ? rows.filter((r) => r.last_sunday_school_date === lastSundayDate).length : 0;

  const unreadItems = ((unread ?? []) as unknown as NotificationRow[]).filter((r) => r.notifications);
  const latestUnread = unreadItems.sort((a, b) =>
    (b.notifications?.sent_at ?? "").localeCompare(a.notifications?.sent_at ?? "")
  )[0];

  return (
    <div className="max-w-xl mx-auto grid grid-cols-2 gap-3">
      <section className="col-span-2 bg-white rounded-[24px] border-2 border-line p-4 shadow-[0_6px_0_#ECDFC8]">
        <h1 className="text-[17px] font-extrabold text-ink mb-3">متابعة النهارده</h1>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col items-center gap-2">
            <ProgressRing done={prayedToday} total={total} />
            <span className="text-sm font-bold text-ink">صلّوا</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <ProgressRing done={readToday} total={total} />
            <span className="text-sm font-bold text-ink">قروا الإصحاح</span>
          </div>
        </div>
      </section>

      <Tile href="/servant/children" label="أولادي" icon="users">
        <Muted>{total > 0 ? `${ar(total)} ولد في المرحلة` : "لا يوجد أولاد بعد"}</Muted>
      </Tile>
      <Tile href="/servant/quizzes" label="المسابقات" icon="trophy">
        {needsReview ? <Pending>{`${ar(needsReview)} محتاجة تصحيح`}</Pending> : <Muted>كله متصحّح</Muted>}
      </Tile>
      <Tile href="/servant/attendance/mass" label="القداس" icon="church">
        <Muted>{`${ar(massLast7)} حضروا آخر ٧ أيام`}</Muted>
      </Tile>
      <Tile href="/servant/attendance/sunday-school" label="مدارس الأحد" icon="books">
        <Muted>
          {lastSundayDate ? `${ar(lastSundayCount)} حضروا · ${relativeArabicDate(lastSundayDate)}` : "لم يسجّل بعد"}
        </Muted>
      </Tile>

      {!!newQuestions && (
        <WideTile
          href="/servant/symposium"
          icon="chat"
          chipClass="bg-gold text-primary-dark"
          title={newQuestions === 1 ? "سؤال جديد في صندوق الندوة" : `${ar(newQuestions)} أسئلة جديدة في صندوق الندوة`}
          subtitle="أسئلة من أولاد مرحلتك مستنية مراجعة"
          badge={ar(newQuestions)}
        />
      )}

      {latestUnread && (
        <WideTile
          href="/servant/notifications"
          icon="bell"
          chipClass="bg-primary text-parchment"
          title={unreadItems.length === 1 ? "إشعار جديد" : `${ar(unreadItems.length)} إشعارات جديدة`}
          subtitle={latestUnread.notifications?.title ?? ""}
          badge={ar(unreadItems.length)}
        />
      )}

      <TodayAttendanceButtons basePath="/servant/attendance" />
    </div>
  );
}
