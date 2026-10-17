import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { canManageContent } from "@/lib/roles";
import { Tile, Done, Muted } from "@/components/home/Tiles";

/** إدارة نصوص الصلاة: مربع لكل صلاة، بيفتح صفحة أجزائها للتعديل. */
export async function PrayerContentPage({ basePath }: { basePath: string }) {
  const { supabase, user, role } = await getCurrentProfile();
  if (!user) redirect("/login");
  if (!role || !canManageContent(role)) redirect("/");

  const [{ data: prayers }, { data: sections }] = await Promise.all([
    supabase.from("prayer_contents").select("id, title_ar, is_active").order("sort_order"),
    supabase.from("prayer_sections").select("prayer_content_id")
  ]);

  const counts = new Map<string, number>();
  for (const s of sections ?? []) counts.set(s.prayer_content_id, (counts.get(s.prayer_content_id) ?? 0) + 1);

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-xl font-extrabold text-ink mb-1">محتوى الصلاة</h1>
      <p className="text-ink-soft text-sm mb-5">
        اختار الصلاة عشان تعدّل نصوص أجزائها. أي تعديل لازم يكون من مصدر كنسي معتمد (كتاب الأجبية)، وكل تعديل بيتسجّل في سجل العمليات.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {(prayers ?? []).map((p) => {
          const n = counts.get(p.id) ?? 0;
          return (
            <Tile key={p.id} href={`${basePath}/${p.id}`} label={p.title_ar} icon="cross">
              {p.is_active ? <Done>{`مفعّلة · ${n.toLocaleString("ar-EG")} جزء`}</Done> : <Muted>{n ? `غير مفعّلة · ${n.toLocaleString("ar-EG")} جزء` : "غير مفعّلة · بدون نص"}</Muted>}
            </Tile>
          );
        })}
      </div>
    </div>
  );
}
