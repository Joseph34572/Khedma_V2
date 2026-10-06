import type { QuestionStatus } from "@/types/database";
export const QUESTION_STATUS_LABELS: Record<QuestionStatus, string> = {
  new: "جديد",
  reviewed: "تمت المراجعة",
  discussed: "تمت مناقشته",
  archived: "مؤرشف"
};
export const QUESTION_STATUS_TONE: Record<QuestionStatus, "warn" | "good" | "muted" | "bad"> = {
  new: "warn",
  reviewed: "good",
  discussed: "good",
  archived: "muted"
};
