import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/Icon";

// مكونات الصفحة الرئيسية المشتركة (الولد والخادم): مربعات حالة قابلة للضغط،
// كروت عريضة بتظهر بس لما يكون فيه حاجة جديدة، ودايرة تقدّم.

const TILE_CLASS = "bg-white rounded-[20px] border-2 border-line p-3.5 shadow-[0_5px_0_#ECDFC8] flex flex-col gap-2";

export function Tile({
  href,
  label,
  icon,
  children
}: {
  href?: string;
  label: string;
  icon: IconName;
  children: React.ReactNode;
}) {
  const body = (
    <>
      <span className="flex items-start justify-between">
        <span className="h-[38px] w-[38px] rounded-xl bg-[#F4E6D3] flex items-center justify-center text-primary">
          <Icon name={icon} size={18} strokeWidth={2.2} />
        </span>
        {href && <Icon name="chevronLeft" size={18} className="text-ink-soft mt-2" />}
      </span>
      <span className="text-[15px] font-bold text-ink">{label}</span>
      {children}
    </>
  );
  return href ? (
    <Link href={href} prefetch={false} className={`playful-card ${TILE_CLASS}`}>
      {body}
    </Link>
  ) : (
    <div className={TILE_CLASS}>{body}</div>
  );
}

export function WideTile({
  href,
  icon,
  chipClass,
  title,
  subtitle,
  badge
}: {
  href: string;
  icon: IconName;
  chipClass: string;
  title: string;
  subtitle: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="playful-card col-span-2 bg-white rounded-[20px] border-2 border-line p-3.5 shadow-[0_5px_0_#ECDFC8] flex items-center gap-3"
    >
      <span className={`relative h-[44px] w-[44px] flex-none rounded-xl flex items-center justify-center ${chipClass}`}>
        <Icon name={icon} size={20} strokeWidth={2.2} />
        {badge && (
          <span
            className={`absolute -top-1.5 -left-1.5 min-w-[20px] h-5 px-1 rounded-full text-[11px] font-extrabold flex items-center justify-center ${
              // الشارة لازم تبان على لون الأيقونة: عنابي فوق الذهبي، وذهبي فوق العنابي.
              chipClass.includes("bg-gold") ? "bg-primary text-parchment" : "bg-gold text-ink"
            }`}
          >
            {badge}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-extrabold text-ink">{title}</span>
        <span className="block text-[13px] text-ink-soft truncate">{subtitle}</span>
      </span>
      <Icon name="chevronLeft" size={18} className="text-ink-soft" />
    </Link>
  );
}

// الحالة دايمًا بأيقونة + نص (مش لون بس)، زي باقي التطبيق.
export function Done({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[13px] font-bold text-good flex items-center gap-1">
      <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path className="anim-check" d="M5 12l5 5 9-10" />
      </svg>
      {children}
    </span>
  );
}

export function Pending({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[13px] font-bold text-[#8A5A00] flex items-center gap-1">
      <span className="anim-tick">
        <Icon name="clock" size={14} strokeWidth={2.5} />
      </span>
      {children}
    </span>
  );
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-[13px] text-ink-soft">{children}</span>;
}

// محيط دايرة التقدّم (نصف القطر 34) — بيتمرّر كمان لـ --ring-full عشان حركة الملء.
const RING_CIRCUMFERENCE = 2 * Math.PI * 34;
const ar = (n: number) => n.toLocaleString("ar-EG");

/** دايرة تقدّم: done من total، بالأرقام العربي في النص. */
export function ProgressRing({ done, total, size = 84 }: { done: number; total: number; size?: number }) {
  const offset = RING_CIRCUMFERENCE * (1 - (total > 0 ? done / total : 0));
  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <svg aria-hidden width={size} height={size} viewBox="0 0 84 84">
        <circle cx="42" cy="42" r="34" fill="none" stroke="#F4E6D3" strokeWidth="10" />
        <circle
          className="anim-ring"
          cx="42"
          cy="42"
          r="34"
          fill="none"
          stroke="#7A1F2B"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          transform="rotate(-90 42 42)"
          style={{ strokeDashoffset: offset, ["--ring-full" as string]: RING_CIRCUMFERENCE }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[19px] font-extrabold text-primary">
        {ar(done)}/{ar(total)}
      </span>
    </div>
  );
}
