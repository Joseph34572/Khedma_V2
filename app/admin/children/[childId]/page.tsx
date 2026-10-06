import { ChildProfilePage } from "@/components/children/ChildProfilePage";

export default function Page({ params }: { params: { childId: string } }) {
  return <ChildProfilePage childId={params.childId} basePath="/admin/children" />;
}
