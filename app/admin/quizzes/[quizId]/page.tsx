import { QuizDetailPage } from "@/components/quizzes/StaffPages";
export default function Page({ params }: { params: { quizId: string } }) {
  return <QuizDetailPage quizId={params.quizId} basePath="/admin/quizzes" />;
}
