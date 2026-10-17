import { Icon, type IconName } from "@/components/ui/Icon";

type Tone = "good" | "warn" | "bad" | "muted";

const TONE_CLASSES: Record<Tone, string> = {
  good: "bg-good/10 text-good",
  warn: "bg-gold/15 text-[#8A5A00]",
  bad: "bg-bad/10 text-bad",
  muted: "bg-line/60 text-ink-soft"
};

// الحالة دايمًا بأيقونة + نص (مش لون بس): ✓ مكتمل، ساعة = لم يكتمل بعد، تحذير =
// متأخر/معطّل. الأيقونة بتتحط تلقائيًا حسب الـ tone، فمفيش داعي لأي emoji في النص.
const TONE_ICONS: Record<Tone, IconName | null> = {
  good: "check",
  warn: "clock",
  bad: "alert",
  muted: null
};

export function StatusBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const icon = TONE_ICONS[tone];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${TONE_CLASSES[tone]}`}>
      {icon && <Icon name={icon} size={13} strokeWidth={tone === "good" ? 3 : 2.5} />}
      {children}
    </span>
  );
}
