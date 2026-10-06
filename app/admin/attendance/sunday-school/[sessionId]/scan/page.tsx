import { ScanPage } from "@/components/attendance/Pages";
export default function Page({ params }: { params: { sessionId: string } }) {
  return <ScanPage kind="sunday_school" entityId={params.sessionId} backHref={`/admin/attendance/sunday-school/${params.sessionId}`} />;
}
