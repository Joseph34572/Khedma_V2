import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { toChildRow } from "@/lib/childRow";
import { QuickStats } from "@/components/children/QuickStats";
import { STAGE_LABELS, type Stage } from "@/lib/roles";

const TILES = [
  { href: "/servant/children", label: "أولادي", icon: "👥", desc: "جدول متابعة أولاد مرحلتك" },
  { href: "/servant/attendance", label: "تسجيل حضور", icon: "📋", desc: "قداسات ومدارس الأحد" },
  { href: "/servant/prayer", label: "الصلاة", icon: "🕊️", desc: "إدارة محتوى الصلاة" },
  { href: "/servant/bible", label: "الكتاب المقدس", icon: "📖", desc: "إدارة محتوى الكتاب المقدس" },
  { href: "/servant/quizzes", label: "المسابقات", icon: "🏆", desc: "إنشاء ومتابعة المسابقات" },
  { href: "/servant/symposium", label: "صندوق الندوة", icon: "💬", desc: "أسئلة أولاد مرحلتك" }
];

export default async function ServantHomePage() {
  const { supabase, user, fullName, stageId } = await getCurrentProfile();
  if (!user) redirect("/login");

  const { data: summary } = await supabase.from("child_activity_summary").select("*").order("full_name", { ascending: true });
  const rows = (summary ?? []).map(toChildRow);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-extrabold text-ink">أهلًا {fullName ?? ""} 👋</h1>
        <p className="text-ink-soft text-sm mt-1">
          متابعة أولاد {stageId ? STAGE_LABELS[stageId as Stage] : "مرحلتك"} اليوم
        </p>
      </div>

      <QuickStats rows={rows} />

      <div className="grid gap-3 sm:grid-cols-3">
        {TILES.map((t) => (
          <Link key={t.href} href={t.href} className="rounded-card border border-line bg-white p-4 hover:border-primary transition-colors">
            <p className="text-2xl mb-1">{t.icon}</p>
            <p className="font-bold text-ink">{t.label}</p>
            <p className="text-ink-soft text-xs mt-1">{t.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
