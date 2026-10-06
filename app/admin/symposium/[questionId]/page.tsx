import { SymposiumDetailPage } from "@/components/symposium/StaffPages";
export default function Page({ params }: { params: { questionId: string } }) {
  return <SymposiumDetailPage questionId={params.questionId} basePath="/admin/symposium" />;
}
