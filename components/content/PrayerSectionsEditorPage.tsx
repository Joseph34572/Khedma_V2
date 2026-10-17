import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { canManageContent } from "@/lib/roles";
import { PrayerSectionEditor, AddPrayerSectionForm, PrayerActiveToggle } from "./PrayerSectionForms";

/** تعديل أجزاء صلاة واحدة: العنوان والنص لكل جزء، إضافة/حذف أجزاء، والتفعيل. */
export async function PrayerSectionsEditorPage({ prayerId, basePath }: { prayerId: string; basePath: string }) {
  const { supabase, user, role } = await getCurrentProfile();
  if (!user) redirect("/login");
  if (!role || !canManageContent(role)) redirect("/");

  const [{ data: prayer }, { data: sections }] = await Promise.all([
    supabase.from("prayer_contents").select("id, title_ar, is_active").eq("id", prayerId).maybeSingle(),
    supabase.from("prayer_sections").select("id, sort_order, title_ar, body_ar").eq("prayer_content_id", prayerId).order("sort_order")
  ]);
  if (!prayer) notFound();

  return (
    <div className="max-w-2xl mx-auto">
      <Link href={basePath} prefetch={false} className="text-sm text-ink-soft hover:underline">
        ‹ كل الصلوات
      </Link>
      <h1 className="text-xl font-extrabold text-ink mt-2 mb-4">{prayer.title_ar}</h1>

      <PrayerActiveToggle prayerId={prayer.id} isActive={prayer.is_active} />

      <ol className="space-y-3 mt-4">
        {(sections ?? []).map((s, i) => (
          <li key={s.id}>
            <PrayerSectionEditor number={i + 1} sectionId={s.id} title={s.title_ar} body={s.body_ar} />
          </li>
        ))}
      </ol>
      {(!sections || sections.length === 0) && <p className="text-ink-soft text-sm mt-4">الصلاة دي لسه مالهاش أجزاء. ضيف أول جزء تحت.</p>}

      <AddPrayerSectionForm prayerId={prayer.id} />
    </div>
  );
}
