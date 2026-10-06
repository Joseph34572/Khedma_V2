"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "./ui/StatusBadge";
import { relativeArabicDate, daysSince } from "@/lib/format";
import type { ChildRow } from "@/lib/childRow";

export type { ChildRow } from "@/lib/childRow";

type SortKey = keyof Pick<
  ChildRow,
  | "full_name"
  | "last_prayer_activity_at"
  | "last_reading_activity_at"
  | "last_mass_date"
  | "last_sunday_school_date"
  | "weekly_activity_percent"
  | "monthly_activity_percent"
>;

function DateCell({ value, warnAfterDays = 3 }: { value: string | null; warnAfterDays?: number }) {
  const days = daysSince(value);
  if (value === null) {
    return <StatusBadge tone="muted">— لم يسجل</StatusBadge>;
  }
  if (days !== null && days === 0) {
    return <StatusBadge tone="good">✅ اليوم</StatusBadge>;
  }
  if (days !== null && days >= warnAfterDays) {
    return <StatusBadge tone="bad">🔴 {relativeArabicDate(value)}</StatusBadge>;
  }
  return <StatusBadge tone="warn">🟡 {relativeArabicDate(value)}</StatusBadge>;
}

function TodayStatusCell({ status }: { status: "completed" | "partial" | "none" }) {
  if (status === "completed") return <StatusBadge tone="good">✅ مكتمل</StatusBadge>;
  if (status === "partial") return <StatusBadge tone="warn">🟡 لم يكتمل بعد</StatusBadge>;
  return <StatusBadge tone="muted">— لم يسجل</StatusBadge>;
}

type ActivityFilter = "all" | "low" | "medium" | "high";

export function ChildrenTable({
  rows,
  showConfession,
  basePath = "/servant"
}: {
  rows: ChildRow[];
  showConfession: boolean;
  basePath?: string;
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("full_name");
  const [sortAsc, setSortAsc] = useState(true);
  const [prayerFilter, setPrayerFilter] = useState<"all" | "completed" | "partial" | "none">("all");
  const [readingFilter, setReadingFilter] = useState<"all" | "completed" | "partial" | "none">("all");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim();
    let list = q ? rows.filter((r) => r.full_name.includes(q)) : rows;
    if (prayerFilter !== "all") list = list.filter((r) => r.today_prayer_status === prayerFilter);
    if (readingFilter !== "all") list = list.filter((r) => r.today_reading_status === readingFilter);
    if (activityFilter !== "all") {
      list = list.filter((r) => {
        const pct = r.weekly_activity_percent ?? 0;
        if (activityFilter === "low") return pct < 40;
        if (activityFilter === "medium") return pct >= 40 && pct < 75;
        return pct >= 75;
      });
    }
    if (dateFrom || dateTo) {
      const from = dateFrom ? new Date(dateFrom).getTime() : -Infinity;
      const to = dateTo ? new Date(dateTo).getTime() + 86_400_000 : Infinity;
      list = list.filter((r) => {
        const dates = [r.last_prayer_activity_at, r.last_reading_activity_at, r.last_mass_date, r.last_sunday_school_date]
          .filter(Boolean)
          .map((d) => new Date(d as string).getTime());
        return dates.some((t) => t >= from && t <= to);
      });
    }
    const sorted = [...list].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [rows, query, sortKey, sortAsc, prayerFilter, readingFilter, activityFilter, dateFrom, dateTo]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  const headerBtn = (key: SortKey, label: string) => (
    <button
      onClick={() => toggleSort(key)}
      className="flex items-center gap-1 font-bold text-ink-soft hover:text-ink"
    >
      {label}
      {sortKey === key && <span aria-hidden>{sortAsc ? "▲" : "▼"}</span>}
    </button>
  );

  const selectCls = "rounded-lg border border-line px-3 py-2 text-sm focus:border-primary outline-none bg-white";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          placeholder="البحث عن ولد بالاسم..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full sm:w-64 rounded-lg border border-line px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
        />
        <select value={prayerFilter} onChange={(e) => setPrayerFilter(e.target.value as typeof prayerFilter)} className={selectCls}>
          <option value="all">كل حالات الصلاة اليوم</option>
          <option value="completed">✅ صلّوا اليوم</option>
          <option value="partial">🟡 لم يكملوا بعد</option>
          <option value="none">— لم يسجلوا</option>
        </select>
        <select value={readingFilter} onChange={(e) => setReadingFilter(e.target.value as typeof readingFilter)} className={selectCls}>
          <option value="all">كل حالات القراءة اليوم</option>
          <option value="completed">✅ قرأوا اليوم</option>
          <option value="partial">🟡 لم يكملوا بعد</option>
          <option value="none">— لم يسجلوا</option>
        </select>
        <select value={activityFilter} onChange={(e) => setActivityFilter(e.target.value as ActivityFilter)} className={selectCls}>
          <option value="all">كل مستويات النشاط</option>
          <option value="high">نشاط مرتفع (75%+)</option>
          <option value="medium">نشاط متوسط (40–74%)</option>
          <option value="low">نشاط منخفض (أقل من 40%)</option>
        </select>
        <div className="flex items-center gap-1.5 text-sm text-ink-soft">
          <span>من</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={selectCls} />
          <span>إلى</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={selectCls} />
        </div>
      </div>

      <div className="table-scroll rounded-card border border-line bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-parchment/60">
              <th className="sticky-col bg-parchment/60 text-right px-4 py-3 whitespace-nowrap">
                {headerBtn("full_name", "اسم الولد")}
              </th>
              <th className="text-right px-4 py-3 whitespace-nowrap">{headerBtn("last_prayer_activity_at", "آخر نشاط صلاة")}</th>
              <th className="text-right px-4 py-3 whitespace-nowrap">حالة صلاة اليوم</th>
              <th className="text-right px-4 py-3 whitespace-nowrap">{headerBtn("last_reading_activity_at", "آخر قراءة للكتاب")}</th>
              <th className="text-right px-4 py-3 whitespace-nowrap">حالة قراءة اليوم</th>
              <th className="text-right px-4 py-3 whitespace-nowrap">{headerBtn("last_mass_date", "آخر حضور قداس")}</th>
              {showConfession && <th className="text-right px-4 py-3 whitespace-nowrap">آخر اعتراف</th>}
              <th className="text-right px-4 py-3 whitespace-nowrap">{headerBtn("last_sunday_school_date", "آخر حضور مدارس الأحد")}</th>
              <th className="text-right px-4 py-3 whitespace-nowrap">{headerBtn("weekly_activity_percent", "نشاط الأسبوع الحالي")}</th>
              <th className="text-right px-4 py-3 whitespace-nowrap">{headerBtn("monthly_activity_percent", "نشاط الشهر الحالي")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.user_id} className="border-b border-line last:border-0 hover:bg-parchment/40">
                <td className="sticky-col bg-white px-4 py-3 font-bold whitespace-nowrap">
                  <Link href={`${basePath}/${row.user_id}`} className="text-primary hover:underline">
                    {row.full_name}
                  </Link>
                </td>
                <td className="px-4 py-3 whitespace-nowrap"><DateCell value={row.last_prayer_activity_at} /></td>
                <td className="px-4 py-3 whitespace-nowrap"><TodayStatusCell status={row.today_prayer_status} /></td>
                <td className="px-4 py-3 whitespace-nowrap"><DateCell value={row.last_reading_activity_at} /></td>
                <td className="px-4 py-3 whitespace-nowrap"><TodayStatusCell status={row.today_reading_status} /></td>
                <td className="px-4 py-3 whitespace-nowrap"><DateCell value={row.last_mass_date} warnAfterDays={8} /></td>
                {showConfession && (
                  <td className="px-4 py-3 whitespace-nowrap"><DateCell value={row.last_confession_at} warnAfterDays={45} /></td>
                )}
                <td className="px-4 py-3 whitespace-nowrap"><DateCell value={row.last_sunday_school_date} warnAfterDays={8} /></td>
                <td className="px-4 py-3 whitespace-nowrap font-bold">{row.weekly_activity_percent ?? 0}%</td>
                <td className="px-4 py-3 whitespace-nowrap font-bold">{row.monthly_activity_percent ?? 0}%</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={showConfession ? 10 : 9} className="text-center text-ink-soft py-8">
                  لا يوجد أولاد مطابقون للبحث أو التصفية الحالية.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
