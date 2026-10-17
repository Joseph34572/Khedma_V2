import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { toChildRow } from "@/lib/childRow";
import { relativeArabicDate } from "@/lib/format";
import { STAGE_LABELS, STAGE_ORDER, canViewAllStages } from "@/lib/roles";
import { Tile, WideTile, Muted, ProgressRing } from "@/components/home/Tiles";
import { TodayAttendanceButtons } from "@/components/home/TodayAttendanceButtons";

type NotificationRow = { id: string; notifications: { title: string; sent_at: string | null } | null };

const ar = (n: number) => n.toLocaleString("ar-EG");

export default async function AdminDashboardPage() {
  const { supabase, user, role } = await getCurrentProfile();
  if (!user || !role) redirect("/login");

  const globalView = canViewAllStages(role);

  // كل الأرقام بتحترم RLS تلقائيًا: أمين المرحلة بيشوف مرحلته بس، والأمين العام/المدير كل المراحل.
  const [{ data: summary }, { count: totalServants }, { count: newQuestions }, { count: needsReview }, { data: unread }] =
    await Promise.all([
      supabase.from("child_activity_summary").select("*"),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "servant").eq("status", "active"),
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

  const raw = summary ?? [];
  const rows = raw.map(toChildRow);
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

  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

  return (
    <div className="max-w-xl mx-auto grid grid-cols-2 gap-3">
      <section className="col-span-2 bg-white rounded-[24px] border-2 border-line p-4 shadow-[0_6px_0_#ECDFC8]">
        <h1 className="text-[17px] font-extrabold text-ink mb-3">{globalView ? "متابعة النهارده · كل المراحل" : "متابعة النهارده"}</h1>
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

      {globalView && (
        <section className="col-span-2 bg-white rounded-[24px] border-2 border-line p-3 shadow-[0_6px_0_#ECDFC8] grid grid-cols-3 gap-2">
          {STAGE_ORDER.map((stage) => {
            const stageRows = raw.filter((r) => r.stage_id === stage).map(toChildRow);
            const count = stageRows.length;
            return (
              <Link
                key={stage}
                href={`/admin/children?stage=${stage}`}
                prefetch={false}
                className="playful-card rounded-2xl bg-parchment p-3 text-center flex flex-col gap-1"
              >
                <span className="text-sm font-extrabold text-ink">{STAGE_LABELS[stage]}</span>
                <span className="text-xs text-ink-soft">{ar(count)} ولد</span>
                <span className="text-xs text-ink">
                  صلاة <b className="text-primary">{ar(pct(stageRows.filter((r) => r.today_prayer_status === "completed").length, count))}٪</b>
                </span>
                <span className="text-xs text-ink">
                  قراءة <b className="text-primary">{ar(pct(stageRows.filter((r) => r.today_reading_status === "completed").length, count))}٪</b>
                </span>
              </Link>
            );
          })}
        </section>
      )}

      <Tile href="/admin/children" label="الأولاد" icon="child">
        <Muted>{total > 0 ? `${ar(total)} ولد` : "لا يوجد أولاد بعد"}</Muted>
      </Tile>
      <Tile href="/admin/servants" label="الخدام" icon="users">
        <Muted>{`${ar(totalServants ?? 0)} خادم`}</Muted>
      </Tile>
      <Tile href="/admin/attendance/mass" label="القداس" icon="church">
        <Muted>{`${ar(massLast7)} حضروا آخر ٧ أيام`}</Muted>
      </Tile>
      <Tile href="/admin/attendance/sunday-school" label="مدارس الأحد" icon="books">
        <Muted>
          {lastSundayDate ? `${ar(lastSundayCount)} حضروا · ${relativeArabicDate(lastSundayDate)}` : "لم يسجّل بعد"}
        </Muted>
      </Tile>

      {!!needsReview && (
        <WideTile
          href="/admin/quizzes"
          icon="trophy"
          chipClass="bg-gold text-primary-dark"
          title={`${ar(needsReview)} ${needsReview === 1 ? "إجابة محتاجة" : "إجابات محتاجة"} تصحيح`}
          subtitle="إجابات نصية أو ملفات مستنية التقييم"
          badge={ar(needsReview)}
        />
      )}

      {!!newQuestions && (
        <WideTile
          href="/admin/symposium"
          icon="chat"
          chipClass="bg-gold text-primary-dark"
          title={newQuestions === 1 ? "سؤال جديد في صندوق الندوة" : `${ar(newQuestions)} أسئلة جديدة في صندوق الندوة`}
          subtitle="أسئلة مستنية مراجعة"
          badge={ar(newQuestions)}
        />
      )}

      {latestUnread && (
        <WideTile
          href="/admin/notifications"
          icon="bell"
          chipClass="bg-primary text-parchment"
          title={unreadItems.length === 1 ? "إشعار جديد" : `${ar(unreadItems.length)} إشعارات جديدة`}
          subtitle={latestUnread.notifications?.title ?? ""}
          badge={ar(unreadItems.length)}
        />
      )}

      <TodayAttendanceButtons basePath="/admin/attendance" />
    </div>
  );
}
