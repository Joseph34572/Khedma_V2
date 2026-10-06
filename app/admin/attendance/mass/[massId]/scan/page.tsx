import { ScanPage } from "@/components/attendance/Pages";
export default function Page({ params }: { params: { massId: string } }) {
  return <ScanPage kind="mass" entityId={params.massId} backHref={`/admin/attendance/mass/${params.massId}`} />;
}
