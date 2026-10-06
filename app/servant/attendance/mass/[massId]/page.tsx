import { MassDetailPage } from "@/components/attendance/Pages";
export default function Page({ params }: { params: { massId: string } }) {
  return <MassDetailPage massId={params.massId} basePath="/servant/attendance" />;
}
