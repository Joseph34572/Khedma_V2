import { SymposiumListPage } from "@/components/symposium/StaffPages";
export default async function Page(props: { searchParams: Promise<{ status?: string; stage?: string; q?: string }> }) {
  const searchParams = await props.searchParams;
  return <SymposiumListPage basePath="/servant/symposium" searchParams={searchParams} />;
}
