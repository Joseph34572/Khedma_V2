/**
 * نوع ودالة عاديان (بدون "use client") حتى يمكن استدعاؤهما من مكوّنات الخادم
 * (Server Components) مباشرة. وضعهما سابقًا داخل ChildrenTable.tsx (وهو ملف
 * "use client") كان يحوّلهما في Next.js إلى مرجع عميل (client reference) عند
 * استيرادهما من صفحة خادم، فيفشل استدعاء toChildRow بخطأ
 * "object is not a function" — راجع توثيق React Server Components.
 */
export type ChildRow = {
  user_id: string;
  full_name: string;
  last_prayer_at: string | null;
  last_prayer_activity_at: string | null;
  today_prayer_status: "completed" | "partial" | "none";
  last_reading_at: string | null;
  last_reading_activity_at: string | null;
  today_reading_status: "completed" | "partial" | "none";
  last_mass_date: string | null;
  last_confession_at: string | null; // فقط إن سُمح بعرضه
  last_sunday_school_date: string | null;
  weekly_activity_percent: number | null;
  monthly_activity_percent: number | null;
};

export function toChildRow(r: {
  user_id: string;
  full_name: string;
  last_prayer_at: string | null;
  last_prayer_activity_at: string | null;
  today_prayer_status: "completed" | "partial" | "none";
  last_reading_at: string | null;
  last_reading_activity_at: string | null;
  today_reading_status: "completed" | "partial" | "none";
  last_mass_date: string | null;
  last_confession_at: string | null;
  last_sunday_school_date: string | null;
  weekly_activity_percent: number | null;
  monthly_activity_percent: number | null;
}): ChildRow {
  return { ...r };
}
