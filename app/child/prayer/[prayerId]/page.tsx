import { PrayerHourPage } from "@/components/prayer/PrayerHourPage";

export default function PrayerPage({ params }: { params: { prayerId: string } }) {
  return <PrayerHourPage prayerId={params.prayerId} backHref="/child/prayer" />;
}
