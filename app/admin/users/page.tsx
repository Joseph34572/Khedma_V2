import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { ROLE_LABELS, STAGE_LABELS, canManageUsers, type AppRole, type Stage } from "@/lib/roles";
import { formatPhoneForDisplay } from "@/lib/phone";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default async function UsersListPage() {
  const { supabase, user, role } = await getCurrentProfile();
  if (!user) redirect("/login");
  if (!role || !canManageUsers(role)) redirect("/admin");

  const { data: users } = await supabase
    .from("profiles")
    .select("id, full_name, phone_normalized, role, stage_id, status")
    .order("full_name");

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-extrabold text-ink">المستخدمون</h1>
        <Link href="/admin/users/new" className="rounded-lg bg-primary text-white px-4 py-2 text-sm font-bold">
          + إضافة مستخدم
        </Link>
      </div>

      <div className="table-scroll rounded-card border border-line bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-parchment/60">
              <th className="text-right px-4 py-3">الاسم</th>
              <th className="text-right px-4 py-3">رقم الهاتف</th>
              <th className="text-right px-4 py-3">النوع</th>
              <th className="text-right px-4 py-3">المرحلة</th>
              <th className="text-right px-4 py-3">الحالة</th>
              <th className="text-right px-4 py-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-bold whitespace-nowrap">{u.full_name}</td>
                <td className="px-4 py-3 whitespace-nowrap" dir="ltr">{formatPhoneForDisplay(u.phone_normalized)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{ROLE_LABELS[u.role as AppRole]}</td>
                <td className="px-4 py-3 whitespace-nowrap">{u.stage_id ? STAGE_LABELS[u.stage_id as Stage] : "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {u.status === "active" ? (
                    <StatusBadge tone="good">نشط</StatusBadge>
                  ) : (
                    <StatusBadge tone="bad">معطّل</StatusBadge>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Link href={`/admin/users/${u.id}`} className="text-primary font-medium hover:underline">
                    إدارة
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
