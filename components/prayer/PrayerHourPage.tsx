import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { PrayerRunner } from "@/components/PrayerRunner";
import { AgpeyaReader } from "@/components/prayer/AgpeyaReader";

/** أول كلمات المزمور (لحد أول علامة ترقيم، بحد أقصى 4 كلمات) — بتتاخد من نص المصدر نفسه. */
function psalmIncipit(body: string): string {
  const firstLine = body.trim().split("\n")[0] ?? "";
  const clause = firstLine.split(/[،,.:؛!?؟]/)[0] ?? "";
  return clause.trim().split(/\s+/).slice(0, 4).join(" ");
}

/**
 * عنوان الجزء للعرض: المزامير بيتكتب جنبها اسمها بين قوسين (أول كلماتها)، ورقم
 * الترتيب اللي في أول العنوان في المصدر، زي "(1)"، بيتشال لأن الأجزاء مترقمة أصلًا.
 * ده عرض بس — النص المحفوظ في القاعدة زي ما هو.
 */
function displayTitle(title: string, body: string): string {
  if (!title.includes("المزمور")) return title;
  // "(1) المزمور الأول" → "المزمور الأول"، و"(المزمور الثالث)" (نصف الليل) → "المزمور الثالث".
  const clean = title.replace(/^\(\d+\)\s*/, "").replace(/^\((.+)\)$/, "$1");
  const incipit = psalmIncipit(body);
  return incipit ? `${clean} (${incipit})` : clean;
}

/**
 * صفحة صلاة واحدة (للولد والخادم): لو الصلاة متقسّمة لأجزاء (prayer_sections) بتفتح
 * قارئ الأجبية بالأجزاء والسحب، ولو لسه نص واحد بس بتفتح PrayerRunner القديم.
 */
export async function PrayerHourPage({ prayerId, backHref }: { prayerId: string; backHref: string }) {
  const { supabase, user } = await getCurrentProfile();
  if (!user) redirect("/login");

  const [{ data: prayer }, { data: sections }] = await Promise.all([
    supabase.from("prayer_contents").select("id, title_ar, body_ar").eq("id", prayerId).eq("is_active", true).maybeSingle(),
    supabase.from("prayer_sections").select("id, title_ar, body_ar").eq("prayer_content_id", prayerId).order("sort_order")
  ]);

  if (!prayer) notFound();

  const parts = (sections ?? []).filter((s) => s.body_ar.trim());
  if (parts.length > 0) {
    return (
      <AgpeyaReader
        prayerContentId={prayer.id}
        title={prayer.title_ar}
        sections={parts.map((s) => ({ id: s.id, title: displayTitle(s.title_ar, s.body_ar), body: s.body_ar }))}
        backHref={backHref}
      />
    );
  }

  return <PrayerRunner prayerContentId={prayer.id} title={prayer.title_ar} body={prayer.body_ar} backHref={backHref} />;
}
