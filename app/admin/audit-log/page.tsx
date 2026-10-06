import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { canManageUsers } from "@/lib/roles";
import { relativeArabicDate } from "@/lib/format";

const ACTION_LABELS: Record<string, string> = {
  create_user: "إنشاء مستخدم",
  update_user: "تعديل مستخدم",
  disable_user: "تعطيل مستخدم",
  enable_user: "إعادة تفعيل مستخدم",
  reset_password: "تغيير كلمة مرور",
  create_quiz: "إنشاء مسابقة",
  delete_quiz: "حذف مسابقة",
  change_question_status: "تغيير حالة سؤال",
  assign_question: "تعيين سؤال لخادم"
};

export default async function AuditLogPage() {
  const { supabase, user, role } = await getCurrentProfile();
  if (!user) redirect("/login");
  if (!role || !canManageUsers(role)) redirect("/admin");

  const { data: log } = await supabase
    .from("audit_log")
    .select("id, action, entity_type, entity_id, details, created_at, actor_id")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div>
      <h1 className="text-xl font-extrabold text-ink mb-4">سجل العمليات</h1>
      <div className="table-scroll rounded-card border border-line bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-parchment/60">
              <th className="text-right px-4 py-3">العملية</th>
              <th className="text-right px-4 py-3">التاريخ</th>
              <th className="text-right px-4 py-3">تفاصيل</th>
            </tr>
          </thead>
          <tbody>
            {(log ?? []).map((entry) => (
              <tr key={entry.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-bold whitespace-nowrap">
                  {ACTION_LABELS[entry.action] ?? entry.action}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-ink-soft">{relativeArabicDate(entry.created_at)}</td>
                <td className="px-4 py-3 text-ink-soft text-xs">
                  <code>{JSON.stringify(entry.details)}</code>
                </td>
              </tr>
            ))}
            {(!log || log.length === 0) && (
              <tr><td colSpan={3} className="text-center text-ink-soft py-8">لا توجد عمليات مسجّلة بعد.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
