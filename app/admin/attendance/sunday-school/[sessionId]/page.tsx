import { SundaySchoolDetailPage } from "@/components/attendance/Pages";
export default function Page({ params }: { params: { sessionId: string } }) {
  return <SundaySchoolDetailPage sessionId={params.sessionId} basePath="/admin/attendance" />;
}
