import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { AttendanceRoster } from "@/components/AttendanceRoster";
import { QrScanner } from "@/components/QrScanner";
import { DeleteSheetButton } from "./DeleteSheetButton";
import { CreateMassForm, CreateSessionForm } from "./Forms";
import { STAGE_LABELS, STAGE_ORDER, canViewAllStages, type Stage } from "@/lib/roles";
import { relativeArabicDate } from "@/lib/format";

async function getMe() {
  const { supabase, user, role, stageId } = await getCurrentProfile();
  if (!user || !role) redirect("/login");
  return { supabase, me: { stage_id: stageId }, role };
}

export function AttendanceHub({ basePath }: { basePath: string }) {
  const cls = "block bg-white rounded-card border border-line p-5 hover:border-primary font-bold";
  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-extrabold text-ink mb-5">الحضور</h1>
      <div className="space-y-3">
        <Link href={`${basePath}/mass`} className={cls}>⛪ حضور القداس</Link>
        <Link href={`${basePath}/sunday-school`} className={cls}>📚 حضور مدارس الأحد</Link>
      </div>
    </div>
  );
}

export async function MassListPage({ basePath }: { basePath: string }) {
  const { supabase, role } = await getMe();
  const { data: masses } = await supabase.from("masses").select("id, title_ar, mass_date").order("mass_date", { ascending: false }).limit(30);
  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-extrabold text-ink mb-5">حضور القداس</h1>
      {canViewAllStages(role) && <CreateMassForm />}
      <div className="space-y-2">
        {(masses ?? []).map((m) => (
          <Link key={m.id} href={`${basePath}/mass/${m.id}`} className="flex justify-between bg-white rounded-card border border-line p-4 hover:border-primary">
            <span className="font-bold">{m.title_ar}</span>
            <span className="text-ink-soft text-sm">{relativeArabicDate(m.mass_date)}</span>
          </Link>
        ))}
        {(!masses || masses.length === 0) && <p className="text-ink-soft text-center py-6">لا توجد قداسات مضافة بعد.</p>}
      </div>
    </div>
  );
}

export async function MassDetailPage({ massId, basePath }: { massId: string; basePath: string }) {
  const { supabase } = await getMe();
  const { data: mass } = await supabase.from("masses").select("id, title_ar, mass_date").eq("id", massId).single();
  if (!mass) notFound();
  const [{ data: kids }, { data: marked }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("role", "member").eq("status", "active").order("full_name"),
    supabase.from("mass_attendance").select("user_id").eq("mass_id", massId)
  ]);
  return (
    <div className="max-w-xl">
      <Link href={`${basePath}/mass`} className="text-sm text-ink-soft hover:underline">‹ رجوع</Link>
      <div className="flex items-center justify-between mt-2 mb-5">
        <h1 className="text-xl font-extrabold text-ink">{mass.title_ar} — {relativeArabicDate(mass.mass_date)}</h1>
        <DeleteSheetButton kind="mass" id={massId} redirectTo={`${basePath}/mass`} />
      </div>
      <Link href={`${basePath}/mass/${massId}/scan`} className="inline-block mb-4 rounded-lg bg-gold text-white px-4 py-2 font-bold">📷 مسح رموز QR</Link>
      <AttendanceRoster kind="mass" entityId={massId} kids={kids ?? []} alreadyMarkedIds={(marked ?? []).map((m) => m.user_id)} />
    </div>
  );
}

export async function SundaySchoolListPage({ basePath }: { basePath: string }) {
  const { supabase, me, role } = await getMe();
  const stages: Stage[] = canViewAllStages(role) ? STAGE_ORDER : me.stage_id ? [me.stage_id as Stage] : [];
  const { data: sessions } = await supabase
    .from("sunday_school_sessions")
    .select("id, stage_id, session_date, starts_at, ends_at")
    .order("session_date", { ascending: false })
    .limit(30);
  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-extrabold text-ink mb-5">حضور مدارس الأحد</h1>
      {stages.length > 0 && <CreateSessionForm stages={stages} />}
      <div className="space-y-2">
        {(sessions ?? []).map((s) => (
          <Link key={s.id} href={`${basePath}/sunday-school/${s.id}`} className="flex justify-between bg-white rounded-card border border-line p-4 hover:border-primary">
            <span className="font-bold">{STAGE_LABELS[s.stage_id]}</span>
            <span className="text-ink-soft text-sm">{relativeArabicDate(s.session_date)}</span>
          </Link>
        ))}
        {(!sessions || sessions.length === 0) && <p className="text-ink-soft text-center py-6">لا توجد جلسات بعد.</p>}
      </div>
    </div>
  );
}

export async function SundaySchoolDetailPage({ sessionId, basePath }: { sessionId: string; basePath: string }) {
  const { supabase } = await getMe();
  const { data: session } = await supabase.from("sunday_school_sessions").select("id, stage_id, session_date").eq("id", sessionId).single();
  if (!session) notFound();
  const [{ data: kids }, { data: marked }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("role", "member").eq("status", "active").eq("stage_id", session.stage_id).order("full_name"),
    supabase.from("sunday_school_attendance").select("user_id").eq("session_id", sessionId)
  ]);
  return (
    <div className="max-w-xl">
      <Link href={`${basePath}/sunday-school`} className="text-sm text-ink-soft hover:underline">‹ رجوع</Link>
      <div className="flex items-center justify-between mt-2 mb-5">
        <h1 className="text-xl font-extrabold text-ink">مدارس الأحد — {STAGE_LABELS[session.stage_id]} — {relativeArabicDate(session.session_date)}</h1>
        <DeleteSheetButton kind="sunday_school" id={sessionId} redirectTo={`${basePath}/sunday-school`} />
      </div>
      <Link href={`${basePath}/sunday-school/${sessionId}/scan`} className="inline-block mb-4 rounded-lg bg-gold text-white px-4 py-2 font-bold">📷 مسح رموز QR</Link>
      <AttendanceRoster kind="sunday_school" entityId={sessionId} kids={kids ?? []} alreadyMarkedIds={(marked ?? []).map((m) => m.user_id)} />
    </div>
  );
}

export async function ScanPage({ kind, entityId, backHref }: { kind: "mass" | "sunday_school"; entityId: string; backHref: string }) {
  const { supabase } = await getMe();
  let title = "";
  if (kind === "mass") {
    const { data } = await supabase.from("masses").select("title_ar, mass_date").eq("id", entityId).single();
    if (!data) notFound();
    title = `${data.title_ar} — ${relativeArabicDate(data.mass_date)}`;
  } else {
    const { data } = await supabase.from("sunday_school_sessions").select("stage_id, session_date").eq("id", entityId).single();
    if (!data) notFound();
    title = `مدارس الأحد — ${STAGE_LABELS[data.stage_id]} — ${relativeArabicDate(data.session_date)}`;
  }
  return (
    <div className="max-w-md">
      <Link href={backHref} className="text-sm text-ink-soft hover:underline">‹ رجوع للقائمة اليدوية</Link>
      <h1 className="text-lg font-extrabold text-ink mt-2 mb-4">مسح رموز الحضور — {title}</h1>
      <QrScanner kind={kind} entityId={entityId} />
    </div>
  );
}
