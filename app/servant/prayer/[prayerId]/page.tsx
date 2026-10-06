import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { PrayerRunner } from "@/components/PrayerRunner";

export default async function ServantPrayerRunPage({ params }: { params: { prayerId: string } }) {
  const { supabase, user } = await getCurrentProfile();
  if (!user) redirect("/login");

  const { data: prayer } = await supabase
    .from("prayer_contents")
    .select("id, title_ar, body_ar, is_active")
    .eq("id", params.prayerId)
    .eq("is_active", true)
    .single();

  if (!prayer) notFound();

  return <PrayerRunner prayerContentId={prayer.id} title={prayer.title_ar} body={prayer.body_ar} backHref="/servant/prayer" />;
}
