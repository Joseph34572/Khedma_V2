import { SymposiumListPage } from "@/components/symposium/StaffPages";
export default function Page({ searchParams }: { searchParams: { status?: string; stage?: string; q?: string } }) {
  return <SymposiumListPage basePath="/admin/symposium" searchParams={searchParams} />;
}
