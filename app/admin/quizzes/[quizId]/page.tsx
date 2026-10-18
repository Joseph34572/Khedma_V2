import { QuizDetailPage } from "@/components/quizzes/StaffPages";
export default async function Page(props: { params: Promise<{ quizId: string }> }) {
  const params = await props.params;
  return <QuizDetailPage quizId={params.quizId} basePath="/admin/quizzes" />;
}
