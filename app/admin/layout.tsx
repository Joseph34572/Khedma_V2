import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { AppShell, type NavItem } from "@/components/AppShell";
import { ROLE_LABELS, STAGE_LABELS, isManagementRole, canManageUsers, canManageContent, homePathForRole, type AppRole } from "@/lib/roles";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, fullName, role, stageId, status } = await getCurrentProfile();
  if (!user || !role) redirect("/login");
  if (status === "disabled") {
    await supabase.auth.signOut();
    redirect("/login?معطل=1");
  }
  if (!isManagementRole(role)) redirect(homePathForRole(role));

  const navItems: NavItem[] = [
    { href: "/admin", label: "الرئيسية", icon: "home" },
    ...(canManageUsers(role) ? ([{ href: "/admin/users", label: "المستخدمون", icon: "user" }] satisfies NavItem[]) : []),
    { href: "/admin/children", label: "الأولاد", icon: "child" },
    { href: "/admin/servants", label: "الخدام", icon: "users" },
    { href: "/admin/attendance", label: "الحضور", icon: "clipboard" },
    ...(canManageContent(role) ? ([{ href: "/admin/content/prayer", label: "محتوى الصلاة", icon: "cross" }] satisfies NavItem[]) : []),
    ...(canManageContent(role) ? ([{ href: "/admin/content/bible", label: "الكتاب المقدس", icon: "book" }] satisfies NavItem[]) : []),
    { href: "/admin/quizzes", label: "المسابقات", icon: "trophy" },
    { href: "/admin/symposium", label: "صندوق الندوة", icon: "chat" },
    { href: "/admin/notifications", label: "الإشعارات", icon: "bell" },
    ...(canManageUsers(role) ? ([{ href: "/admin/audit-log", label: "سجل العمليات", icon: "folder" }] satisfies NavItem[]) : [])
  ];

  return (
    <AppShell
      navItems={navItems}
      userName={fullName ?? ""}
      roleLabel={stageId ? `${ROLE_LABELS[role]} · ${STAGE_LABELS[stageId]}` : ROLE_LABELS[role]}
      profileHref="/admin/account"
    >
      {children}
    </AppShell>
  );
}
