import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { todayInCairo } from "@/lib/today";
import { STAGE_LABELS, type Stage } from "@/lib/roles";
import { Icon } from "@/components/ui/Icon";

/**
 * زراير "مسح حضور" بتظهر بس لو فيه قداس أو حصة مدارس أحد متسجلة النهارده،
 * وبتودّي على صفحة المسح بالكاميرا على طول. RLS بيقصر حصص مدارس الأحد على
 * مرحلة الخادم/الأمين (والأمناء العامين بيشوفوا كل المراحل).
 * بترجع fragment عشان كل زرار يبقى عنصر مستقل جوه grid الصفحة (col-span-2).
 */
export async function TodayAttendanceButtons({ basePath }: { basePath: "/servant/attendance" | "/admin/attendance" }) {
  const { supabase } = await getCurrentProfile();
  const today = todayInCairo();

  const [{ data: masses }, { data: sessions }] = await Promise.all([
    supabase.from("masses").select("id, title_ar").eq("mass_date", today),
    supabase.from("sunday_school_sessions").select("id, stage_id").eq("session_date", today)
  ]);

  const showStage = (sessions ?? []).length > 1;

  return (
    <>
      {(masses ?? []).map((m) => (
        <ScanButton
          key={m.id}
          href={`${basePath}/mass/${m.id}/scan`}
          label={`مسح حضور القداس${m.title_ar ? ` · ${m.title_ar}` : ""}`}
          tone="primary"
        />
      ))}
      {(sessions ?? []).map((s) => (
        <ScanButton
          key={s.id}
          href={`${basePath}/sunday-school/${s.id}/scan`}
          label={`مسح حضور مدارس الأحد${showStage ? ` · ${STAGE_LABELS[s.stage_id as Stage]}` : ""}`}
          tone="gold"
        />
      ))}
    </>
  );
}

function ScanButton({ href, label, tone }: { href: string; label: string; tone: "primary" | "gold" }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={`col-span-2 min-h-[56px] px-4 rounded-[18px] text-base font-extrabold flex items-center justify-center gap-2 text-center mt-1.5 ${
        tone === "primary" ? "bg-primary text-parchment" : "bg-gold text-ink"
      }`}
    >
      <Icon name="camera" size={20} />
      <span className="truncate">{label}</span>
    </Link>
  );
}
