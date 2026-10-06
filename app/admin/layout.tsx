import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { AppShell, type NavItem } from "@/components/AppShell";
import { ROLE_LABELS, isManagementRole, canManageUsers, canManageContent, homePathForRole, type AppRole } from "@/lib/roles";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, fullName, role, status } = await getCurrentProfile();
  if (!user || !role) redirect("/login");
  if (status === "disabled") {
    await supabase.auth.signOut();
    redirect("/login?معطل=1");
  }
  if (!isManagementRole(role)) redirect(homePathForRole(role));

  const navItems: NavItem[] = [
    { href: "/admin", label: "الرئيسية", icon: "🏠" },
    ...(canManageUsers(role) ? [{ href: "/admin/users", label: "المستخدمون", icon: "👤" }] : []),
    { href: "/admin/children", label: "الأولاد", icon: "🧒" },
    { href: "/admin/servants", label: "الخدام", icon: "👥" },
    { href: "/admin/attendance", label: "الحضور", icon: "📋" },
    ...(canManageContent(role) ? [{ href: "/admin/content/prayer", label: "محتوى الصلاة", icon: "🕊️" }] : []),
    ...(canManageContent(role) ? [{ href: "/admin/content/bible", label: "الكتاب المقدس", icon: "📖" }] : []),
    { href: "/admin/quizzes", label: "المسابقات", icon: "🏆" },
    { href: "/admin/symposium", label: "صندوق الندوة", icon: "💬" },
    { href: "/admin/notifications", label: "الإشعارات", icon: "🔔" },
    ...(canManageUsers(role) ? [{ href: "/admin/audit-log", label: "سجل العمليات", icon: "🗂️" }] : [])
  ];

  return (
    <AppShell navItems={navItems} userName={fullName ?? ""} roleLabel={ROLE_LABELS[role]}>
      {children}
    </AppShell>
  );
}
