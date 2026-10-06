import { ScanPage } from "@/components/attendance/Pages";
export default function Page({ params }: { params: { massId: string } }) {
  return <ScanPage kind="mass" entityId={params.massId} backHref={`/servant/attendance/mass/${params.massId}`} />;
}
