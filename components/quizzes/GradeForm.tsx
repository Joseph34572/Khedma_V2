"use client";

import { useState, useTransition } from "react";
import { gradeAttemptAction } from "@/lib/actions/quizzes";

export function GradeForm({ attemptId, maxScore, score, feedback }: { attemptId: string; maxScore: number; score: number | null; feedback: string | null }) {
  const [s, setS] = useState(score?.toString() ?? "");
  const [f, setF] = useState(feedback ?? "");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, start] = useTransition();
  function save() {
    setMsg(null);
    start(async () => {
      const r = await gradeAttemptAction(attemptId, Number(s), f);
      setMsg(r.error ? { text: r.error, ok: false } : { text: "تم الحفظ", ok: true });
    });
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="number" min={0} max={maxScore} step="0.5" value={s} onChange={(e) => setS(e.target.value)} className="w-20 rounded-lg border border-line px-2 py-1.5 text-sm" placeholder={`/${maxScore}`} />
      <input value={f} onChange={(e) => setF(e.target.value)} className="w-44 rounded-lg border border-line px-2 py-1.5 text-sm" placeholder="ملاحظة للولد" />
      <button onClick={save} disabled={pending || s === ""} className="rounded-lg bg-primary text-white px-3 py-1.5 text-sm font-bold disabled:opacity-60">حفظ</button>
      {msg && <span className={`text-xs ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</span>}
    </div>
  );
}
