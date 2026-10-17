import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { AppShell, type NavItem } from "@/components/AppShell";
import { ROLE_LABELS, STAGE_LABELS, isStaffRole, homePathForRole } from "@/lib/roles";

const NAV_ITEMS: NavItem[] = [
  { href: "/servant", label: "الرئيسية", icon: "home" },
  { href: "/servant/children", label: "أولادي", icon: "users" },
  { href: "/servant/attendance", label: "تسجيل حضور", icon: "clipboard" },
  { href: "/servant/prayer", label: "الصلاة", icon: "cross" },
  { href: "/servant/bible", label: "الكتاب المقدس", icon: "book" },
  { href: "/servant/quizzes", label: "المسابقات", icon: "trophy" },
  { href: "/servant/symposium", label: "صندوق الندوة", icon: "chat" },
  { href: "/servant/notifications", label: "الإشعارات", icon: "bell" }
];

export default async function ServantLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, fullName, role, stageId, status } = await getCurrentProfile();
  if (!user || !role) redirect("/login");
  if (status === "disabled") {
    await supabase.auth.signOut();
    redirect("/login?معطل=1");
  }
  // الأولاد (member) مش من ضمن قسم الخدمة ده — نفس القيد اللي كان في middleware قبل كده.
  if (!isStaffRole(role)) redirect(homePathForRole(role));

  return (
    <AppShell
      navItems={NAV_ITEMS}
      userName={fullName ?? ""}
      roleLabel={stageId ? `${ROLE_LABELS[role]} · ${STAGE_LABELS[stageId]}` : ROLE_LABELS[role]}
      profileHref="/servant/qr"
    >
      {children}
    </AppShell>
  );
}
