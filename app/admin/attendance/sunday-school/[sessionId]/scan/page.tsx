import { ScanPage } from "@/components/attendance/Pages";
export default async function Page(props: { params: Promise<{ sessionId: string }> }) {
  const params = await props.params;
  return <ScanPage kind="sunday_school" entityId={params.sessionId} backHref={`/admin/attendance/sunday-school/${params.sessionId}`} />;
}
