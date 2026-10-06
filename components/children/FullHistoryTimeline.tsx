export type TimelineDay = { date: string; items: { ok: boolean; label: string }[] };

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("ar-EG", { day: "numeric", month: "long" });
}

export function FullHistoryTimeline({ days }: { days: TimelineDay[] }) {
  if (days.length === 0) {
    return <p className="text-sm text-ink-soft">لا يوجد نشاط مسجّل بعد.</p>;
  }

  return (
    <ol className="space-y-5">
      {days.map((day) => (
        <li key={day.date}>
          <p className="font-bold text-ink mb-1.5">{formatDay(day.date)}</p>
          <ul className="space-y-1 text-sm">
            {day.items.map((item, i) => (
              <li key={i}>
                {item.ok ? "✅" : "❌"} {item.label}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
