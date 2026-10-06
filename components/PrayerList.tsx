import Link from "next/link";
import { StatusBadge } from "./ui/StatusBadge";

export type PrayerListItem = {
  id: string;
  title_ar: string;
  completedToday: boolean;
};

export function PrayerList({ items, basePath }: { items: PrayerListItem[]; basePath: string }) {
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-card border border-line p-8 text-center text-ink-soft">
        لا توجد صلوات مفعّلة بعد. سيتم إضافتها من الإدارة قريبًا.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((p) => (
        <Link
          key={p.id}
          href={`${basePath}/${p.id}`}
          className="flex items-center justify-between bg-white rounded-card border border-line p-4 hover:border-primary transition-colors"
        >
          <span className="font-bold text-ink">{p.title_ar}</span>
          {p.completedToday ? <StatusBadge tone="good">✅ تمت اليوم</StatusBadge> : <StatusBadge tone="muted">لم تبدأ اليوم</StatusBadge>}
        </Link>
      ))}
    </div>
  );
}
