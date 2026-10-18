import { PrayerHourPage } from "@/components/prayer/PrayerHourPage";

export default async function PrayerPage(props: { params: Promise<{ prayerId: string }> }) {
  const params = await props.params;
  return <PrayerHourPage prayerId={params.prayerId} backHref="/servant/prayer" />;
}
