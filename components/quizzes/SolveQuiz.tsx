"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { submitQuizAttemptAction, type AnswerMap } from "@/lib/actions/quizzes";

type Q = { id: string; question_type: "single_choice" | "multiple_choice" | "true_false" | "text"; prompt: string; points: number; choices: { id: string; choice_text: string }[] };

export function SolveQuiz({ attemptId, endsAtMs, questions, basePath }: { attemptId: string; endsAtMs: number; questions: Q[]; basePath: string }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [remaining, setRemaining] = useState(Math.max(0, Math.round((endsAtMs - Date.now()) / 1000)));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submittedRef = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  async function submit() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setBusy(true);
    const r = await submitQuizAttemptAction(attemptId, answers);
    setBusy(false);
    if ("error" in r) {
      setError(r.error);
      submittedRef.current = false;
      return;
    }
    router.push(basePath);
  }

  useEffect(() => {
    if (remaining === 0 && !submittedRef.current) submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  const mm = Math.floor(remaining / 60), ss = remaining % 60;

  return (
    <div className="max-w-xl">
      <div className="sticky top-0 bg-parchment/95 backdrop-blur py-2 z-10 mb-3 text-center">
        <span className={`inline-block rounded-full px-4 py-1.5 font-extrabold ${remaining < 30 ? "bg-bad/10 text-bad" : "bg-primary/10 text-primary"}`}>
          ⏱ {mm}:{ss.toString().padStart(2, "0")}
        </span>
      </div>

      <div className="space-y-4">
        {questions.map((q, i) => (
          <div key={q.id} className="bg-white rounded-card border border-line p-5">
            <p className="font-bold mb-3">{i + 1}. {q.prompt}</p>
            {q.question_type === "text" ? (
              <textarea
                rows={3}
                className="w-full rounded-lg border border-line px-3 py-2"
                value={answers[q.id]?.text ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: { text: e.target.value } }))}
              />
            ) : (
              <div className="space-y-2">
                {q.choices.map((c) => {
                  const isMulti = q.question_type === "multiple_choice";
                  const picked = answers[q.id]?.choiceIds ?? [];
                  const checked = picked.includes(c.id);
                  return (
                    <label key={c.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2.5 cursor-pointer has-[:checked]:border-primary">
                      <input
                        type={isMulti ? "checkbox" : "radio"}
                        name={q.id}
                        checked={checked}
                        onChange={() =>
                          setAnswers((a) => ({
                            ...a,
                            [q.id]: { choiceIds: isMulti ? (checked ? picked.filter((x) => x !== c.id) : [...picked, c.id]) : [c.id] }
                          }))
                        }
                      />
                      {c.choice_text}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-bad text-sm bg-bad/10 rounded-lg px-3 py-2 mt-4">{error}</p>}
      <button onClick={submit} disabled={busy} className="w-full mt-4 rounded-lg bg-primary text-white py-3 font-bold disabled:opacity-60">
        {busy ? "جاري التسليم..." : "تسليم الإجابات"}
      </button>
    </div>
  );
}
