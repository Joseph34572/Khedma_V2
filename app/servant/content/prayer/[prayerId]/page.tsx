import { PrayerSectionsEditorPage } from "@/components/content/PrayerSectionsEditorPage";

export default async function Page(props: { params: Promise<{ prayerId: string }> }) {
  const params = await props.params;
  return <PrayerSectionsEditorPage prayerId={params.prayerId} basePath="/servant/content/prayer" />;
}
