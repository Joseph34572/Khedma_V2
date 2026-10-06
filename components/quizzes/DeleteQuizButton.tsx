"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteQuizAction } from "@/lib/actions/quizzes";

export function DeleteQuizButton({ quizId, backHref }: { quizId: string; backHref: string }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  async function del() {
    if (!window.confirm("هل تريد حذف المسابقة نهائيًا مع كل المحاولات والملفات؟")) return;
    const r = await deleteQuizAction(quizId);
    if (r.error) setErr(r.error);
    else router.push(backHref);
  }
  return (
    <span>
      <button onClick={del} className="text-bad text-sm font-bold">🗑 حذف المسابقة</button>
      {err && <span className="text-bad text-xs ms-2">{err}</span>}
    </span>
  );
}
