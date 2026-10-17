import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { AppShell, type NavItem } from "@/components/AppShell";
import { ROLE_LABELS, STAGE_LABELS } from "@/lib/roles";

const NAV_ITEMS: NavItem[] = [
  { href: "/child", label: "الرئيسية", icon: "home" },
  { href: "/child/prayer", label: "الصلاة", icon: "cross" },
  { href: "/child/bible", label: "الكتاب المقدس", icon: "book" },
  { href: "/child/mass", label: "الحضور", icon: "clipboard" },
  { href: "/child/quizzes", label: "المسابقات", icon: "trophy" },
  { href: "/child/symposium", label: "صندوق الندوة", icon: "chat" },
  { href: "/child/notifications", label: "الإشعارات", icon: "bell" }
];

export default async function ChildLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, fullName, role, stageId, status } = await getCurrentProfile();
  if (!user || !role) redirect("/login");
  if (status === "disabled") {
    await supabase.auth.signOut();
    redirect("/login?معطل=1");
  }
  // كل الأدوار مسموح لها تدخل قسم الولد (أولاد وخدام وأمناء ومديرين)، زي ما كان في middleware.

  return (
    <AppShell
      navItems={NAV_ITEMS}
      userName={fullName ?? ""}
      // للولد بنعرض مرحلته (أولى/تانية/تالتة إعدادي) بدل "مستخدم عادي".
      roleLabel={role === "member" && stageId ? STAGE_LABELS[stageId] : ROLE_LABELS[role]}
      profileHref="/child/account"
    >
      {children}
    </AppShell>
  );
}
