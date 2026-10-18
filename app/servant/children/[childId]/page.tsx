import { ChildProfilePage } from "@/components/children/ChildProfilePage";

export default async function Page(props: { params: Promise<{ childId: string }> }) {
  const params = await props.params;
  return <ChildProfilePage childId={params.childId} basePath="/servant/children" />;
}
