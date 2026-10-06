import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { AppShell, type NavItem } from "@/components/AppShell";
import { ROLE_LABELS } from "@/lib/roles";

const NAV_ITEMS: NavItem[] = [
  { href: "/child", label: "الرئيسية", icon: "🏠" },
  { href: "/child/prayer", label: "الصلاة", icon: "🕊️" },
  { href: "/child/bible", label: "الكتاب المقدس", icon: "📖" },
  { href: "/child/mass", label: "الحضور", icon: "📋" },
  { href: "/child/quizzes", label: "المسابقات", icon: "🏆" },
  { href: "/child/symposium", label: "صندوق الندوة", icon: "💬" },
  { href: "/child/notifications", label: "الإشعارات", icon: "🔔" },
  { href: "/child/account", label: "حسابي", icon: "🪪" }
];

export default async function ChildLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, fullName, role, status } = await getCurrentProfile();
  if (!user || !role) redirect("/login");
  if (status === "disabled") {
    await supabase.auth.signOut();
    redirect("/login?معطل=1");
  }
  // كل الأدوار مسموح لها تدخل قسم الولد (أولاد وخدام وأمناء ومديرين)، زي ما كان في middleware.

  return (
    <AppShell navItems={NAV_ITEMS} userName={fullName ?? ""} roleLabel={ROLE_LABELS[role]}>
      {children}
    </AppShell>
  );
}
