import { SundaySchoolDetailPage } from "@/components/attendance/Pages";
export default async function Page(props: { params: Promise<{ sessionId: string }> }) {
  const params = await props.params;
  return <SundaySchoolDetailPage sessionId={params.sessionId} basePath="/admin/attendance" />;
}
