import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { AppShell, type NavItem } from "@/components/AppShell";
import { ROLE_LABELS, isStaffRole, homePathForRole } from "@/lib/roles";

const NAV_ITEMS: NavItem[] = [
  { href: "/servant", label: "الرئيسية", icon: "🏠" },
  { href: "/servant/children", label: "أولادي", icon: "👥" },
  { href: "/servant/attendance", label: "تسجيل حضور", icon: "📋" },
  { href: "/servant/prayer", label: "الصلاة", icon: "🕊️" },
  { href: "/servant/bible", label: "الكتاب المقدس", icon: "📖" },
  { href: "/servant/quizzes", label: "المسابقات", icon: "🏆" },
  { href: "/servant/symposium", label: "صندوق الندوة", icon: "💬" },
  { href: "/servant/notifications", label: "الإشعارات", icon: "🔔" },
  { href: "/servant/qr", label: "حسابي", icon: "🪪" }
];

export default async function ServantLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, fullName, role, status } = await getCurrentProfile();
  if (!user || !role) redirect("/login");
  if (status === "disabled") {
    await supabase.auth.signOut();
    redirect("/login?معطل=1");
  }
  // الأولاد (member) مش من ضمن قسم الخدمة ده — نفس القيد اللي كان في middleware قبل كده.
  if (!isStaffRole(role)) redirect(homePathForRole(role));

  return (
    <AppShell navItems={NAV_ITEMS} userName={fullName ?? ""} roleLabel={ROLE_LABELS[role]}>
      {children}
    </AppShell>
  );
}
