import { MassDetailPage } from "@/components/attendance/Pages";
export default async function Page(props: { params: Promise<{ massId: string }> }) {
  const params = await props.params;
  return <MassDetailPage massId={params.massId} basePath="/servant/attendance" />;
}
