import { PrayerSectionsEditorPage } from "@/components/content/PrayerSectionsEditorPage";

export default function Page({ params }: { params: { prayerId: string } }) {
  return <PrayerSectionsEditorPage prayerId={params.prayerId} basePath="/admin/content/prayer" />;
}
