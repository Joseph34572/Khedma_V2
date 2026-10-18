import { ScanPage } from "@/components/attendance/Pages";
export default async function Page(props: { params: Promise<{ massId: string }> }) {
  const params = await props.params;
  return <ScanPage kind="mass" entityId={params.massId} backHref={`/servant/attendance/mass/${params.massId}`} />;
}
