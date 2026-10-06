type Tone = "good" | "warn" | "bad" | "muted";

const TONE_CLASSES: Record<Tone, string> = {
  good: "bg-good/10 text-good",
  warn: "bg-gold/15 text-gold-dark",
  bad: "bg-bad/10 text-bad",
  muted: "bg-line/60 text-ink-soft"
};

export function StatusBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${TONE_CLASSES[tone]}`}>
      {children}
    </span>
  );
}
