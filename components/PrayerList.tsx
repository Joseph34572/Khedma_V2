import { Tile, Done, Muted } from "@/components/home/Tiles";

export type PrayerListItem = {
  id: string;
  title_ar: string;
  completedToday: boolean;
};

/** الصلوات (ساعات الأجبية) كمربعات: كل مربع بيفتح الساعة وأجزاءها. */
export function PrayerList({ items, basePath }: { items: PrayerListItem[]; basePath: string }) {
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-card border border-line p-8 text-center text-ink-soft">
        لا توجد صلوات مفعّلة بعد. سيتم إضافتها من الإدارة قريبًا.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((p) => (
        <Tile key={p.id} href={`${basePath}/${p.id}`} label={p.title_ar} icon="cross">
          {p.completedToday ? <Done>تمت اليوم</Done> : <Muted>لم تبدأ اليوم</Muted>}
        </Tile>
      ))}
    </div>
  );
}
