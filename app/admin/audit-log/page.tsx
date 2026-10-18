import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { canManageUsers, ROLE_LABELS, type AppRole } from "@/lib/roles";
import { relativeArabicDate } from "@/lib/format";

const ACTION_LABELS: Record<string, string> = {
  login: "تسجيل دخول",
  login_failed: "محاولة دخول غلط",
  login_blocked: "محاولة دخول محظورة (محاولات كتير)",
  login_disabled: "محاولة دخول بحساب معطّل",
  logout: "تسجيل خروج",
  create_user: "إنشاء مستخدم",
  update_user: "تعديل مستخدم",
  disable_user: "تعطيل مستخدم",
  enable_user: "إعادة تفعيل مستخدم",
  delete_user: "حذف حساب نهائيًا",
  reset_password: "تغيير كلمة مرور",
  create_child: "إضافة ولد",
  update_child: "تعديل بيانات ولد",
  disable_child: "تعطيل حساب ولد",
  enable_child: "إعادة تفعيل حساب ولد",
  reset_child_password: "تغيير كلمة مرور ولد",
  create_mass: "إنشاء قداس",
  delete_mass: "حذف قداس",
  create_sunday_school_session: "إنشاء جلسة مدارس أحد",
  delete_sunday_school_session: "حذف جلسة مدارس أحد",
  record_mass_attendance: "تسجيل حضور قداس (يدوي)",
  record_sunday_school_attendance: "تسجيل حضور مدارس أحد (يدوي)",
  scan_attendance: "تسجيل حضور بالـ QR",
  scan_attendance_failed: "مسح QR فشل",
  self_report_mass: "الولد سجّل حضوره للقداس",
  start_prayer: "بدء صلاة",
  finish_prayer: "إنهاء صلاة",
  start_reading: "بدء قراءة إصحاح",
  finish_reading: "إنهاء قراءة إصحاح",
  update_prayer_content: "تعديل نص صلاة",
  update_prayer_section: "تعديل جزء من صلاة",
  add_prayer_section: "إضافة جزء لصلاة",
  delete_prayer_section: "حذف جزء من صلاة",
  activate_prayer: "تفعيل صلاة",
  deactivate_prayer: "إلغاء تفعيل صلاة",
  import_bible_chapter: "استيراد إصحاح",
  create_quiz: "إنشاء مسابقة",
  delete_quiz: "حذف مسابقة",
  start_quiz_attempt: "بدء محاولة مسابقة",
  submit_quiz_attempt: "تسليم مسابقة",
  submit_quiz_file: "تسليم ملف مسابقة",
  grade_attempt: "تصحيح إجابة",
  submit_question: "إرسال سؤال للندوة",
  add_question_note: "ملاحظة على سؤال",
  change_question_status: "تغيير حالة سؤال",
  assign_question: "تعيين سؤال لخادم",
  send_notification: "إرسال إشعار",
  read_notification: "قراءة إشعار"
};

// عمليات "حساسة" بتتلوّن باللون التحذيري عشان تلفت النظر بسرعة.
const SENSITIVE_ACTIONS = new Set([
  "delete_user",
  "disable_user",
  "disable_child",
  "delete_mass",
  "delete_sunday_school_session",
  "delete_quiz",
  "delete_prayer_section",
  "deactivate_prayer",
  "login_failed",
  "login_blocked",
  "login_disabled"
]);

// فلاتر السجل حسب النوع (الأكشنز اللي ملهاش فئة بتظهر في "الكل" بس).
const CATEGORIES: { key: string; label: string; actions: string[] }[] = [
  { key: "auth", label: "الدخول والخروج", actions: ["login", "login_failed", "login_blocked", "login_disabled", "logout"] },
  {
    key: "accounts",
    label: "الحسابات",
    actions: ["create_user", "update_user", "disable_user", "enable_user", "delete_user", "reset_password", "create_child", "update_child", "disable_child", "enable_child", "reset_child_password"]
  },
  {
    key: "attendance",
    label: "الحضور",
    actions: ["create_mass", "delete_mass", "create_sunday_school_session", "delete_sunday_school_session", "record_mass_attendance", "record_sunday_school_attendance", "scan_attendance", "scan_attendance_failed", "self_report_mass"]
  },
  { key: "spiritual", label: "الصلاة والقراءة", actions: ["start_prayer", "finish_prayer", "start_reading", "finish_reading", "update_prayer_content", "update_prayer_section", "add_prayer_section", "delete_prayer_section", "activate_prayer", "deactivate_prayer", "import_bible_chapter"] },
  { key: "quizzes", label: "المسابقات", actions: ["create_quiz", "delete_quiz", "start_quiz_attempt", "submit_quiz_attempt", "submit_quiz_file", "grade_attempt"] },
  { key: "other", label: "الندوة والإشعارات", actions: ["submit_question", "add_question_note", "change_question_status", "assign_question", "send_notification", "read_notification"] }
];

type AuditRow = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  actor_id: string | null;
  actor: { full_name: string; role: AppRole } | { full_name: string; role: AppRole }[] | null;
};

function actorOf(row: AuditRow): { full_name: string; role: AppRole } | null {
  if (!row.actor) return null;
  return Array.isArray(row.actor) ? (row.actor[0] ?? null) : row.actor;
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Cairo" });
}

export default async function AuditLogPage(props: { searchParams: Promise<{ type?: string }> }) {
  const searchParams = await props.searchParams;
  const { supabase, user, role } = await getCurrentProfile();
  if (!user) redirect("/login");
  if (!role || !canManageUsers(role)) redirect("/admin");

  const category = CATEGORIES.find((c) => c.key === searchParams.type) ?? null;
  let query = supabase
    .from("audit_log")
    .select("id, action, entity_type, entity_id, details, created_at, actor_id, actor:profiles!audit_log_actor_id_fkey(full_name, role)")
    .order("created_at", { ascending: false })
    .limit(300);
  if (category) query = query.in("action", category.actions);
  const { data: log } = await query;

  const rows = (log ?? []) as unknown as AuditRow[];

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-extrabold text-ink">سجل العمليات</h1>
        <p className="text-sm text-ink-soft mt-1">آخر {rows.length} عملية — كل حاجة بتحصل: الدخول (وحتى المحاولات الغلط)، الحضور، الصلاة، المسابقات، وإدارة الحسابات.</p>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <FilterChip href="/admin/audit-log" label="الكل" active={!category} />
        {CATEGORIES.map((c) => (
          <FilterChip key={c.key} href={`/admin/audit-log?type=${c.key}`} label={c.label} active={category?.key === c.key} />
        ))}
      </div>

      <div className="rounded-card border border-line bg-white divide-y divide-line overflow-hidden">
        {rows.length === 0 && <p className="text-center text-ink-soft py-10">لا توجد عمليات مسجّلة بعد.</p>}

        {rows.map((entry) => {
          const actor = actorOf(entry);
          const sensitive = SENSITIVE_ACTIONS.has(entry.action);
          const detailsText = Object.keys(entry.details ?? {}).length > 0 ? JSON.stringify(entry.details) : null;

          return (
            <div key={entry.id} className="flex items-start gap-3 px-4 py-3">
              <div
                className={`mt-0.5 h-2.5 w-2.5 rounded-full flex-shrink-0 ${sensitive ? "bg-bad" : "bg-gold"}`}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className={`font-bold text-sm ${sensitive ? "text-bad" : "text-ink"}`}>
                    {ACTION_LABELS[entry.action] ?? entry.action}
                  </span>
                  <span className="text-ink-soft text-xs">
                    {actor ? (
                      <>
                        بواسطة <span className="font-semibold text-ink">{actor.full_name}</span>
                        <span className="text-ink-soft"> ({ROLE_LABELS[actor.role]})</span>
                      </>
                    ) : entry.actor_id ? (
                      "بواسطة مستخدم محذوف"
                    ) : typeof entry.details?.phone === "string" ? (
                      <>
                        من الرقم <span className="font-semibold text-ink" dir="ltr">0{entry.details.phone.slice(2)}</span>
                      </>
                    ) : (
                      "بواسطة مستخدم غير معروف/مجهول"
                    )}
                  </span>
                </div>
                {detailsText && (
                  <p className="text-xs text-ink-soft mt-1 break-all" dir="ltr">
                    {detailsText}
                  </p>
                )}
              </div>
              <span className="text-xs text-ink-soft whitespace-nowrap flex-shrink-0 text-left">
                {relativeArabicDate(entry.created_at)}
                <br />
                {timeOf(entry.created_at)}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-ink-soft mt-3">
        السجل يحتفظ تلقائيًا بعمليات آخر 180 يوم فقط، عشان يفضل خفيف ومرتّب.
      </p>
    </div>
  );
}

function FilterChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <a
      href={href}
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium border ${
        active ? "bg-primary text-white border-primary" : "border-line text-ink-soft hover:border-primary"
      }`}
    >
      {label}
    </a>
  );
}
