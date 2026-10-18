import { SymposiumDetailPage } from "@/components/symposium/StaffPages";
export default async function Page(props: { params: Promise<{ questionId: string }> }) {
  const params = await props.params;
  return <SymposiumDetailPage questionId={params.questionId} basePath="/admin/symposium" />;
}
