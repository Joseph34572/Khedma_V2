"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createQuizAction, prepareQuizAttachmentUploadAction } from "@/lib/actions/quizzes";
import { uploadToSigned, ACCEPT } from "./upload";
import { STAGE_LABELS, type Stage } from "@/lib/roles";

type QType = "single_choice" | "multiple_choice" | "true_false" | "text";
type Choice = { text: string; correct: boolean };
type Question = { type: QType; prompt: string; points: number; choices: Choice[] };

const TYPE_LABELS: Record<QType, string> = {
  single_choice: "اختيار من متعدد (إجابة واحدة)",
  multiple_choice: "اختيار أكثر من إجابة",
  true_false: "صح أو خطأ",
  text: "سؤال نصي"
};

function blank(type: QType): Question {
  if (type === "true_false") return { type, prompt: "", points: 1, choices: [{ text: "صح", correct: true }, { text: "خطأ", correct: false }] };
  if (type === "text") return { type, prompt: "", points: 1, choices: [] };
  return { type, prompt: "", points: 1, choices: [{ text: "", correct: true }, { text: "", correct: false }] };
}

const input = "w-full rounded-lg border border-line px-3.5 py-2.5 bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none";

export function QuizBuilder({ stages, basePath }: { stages: Stage[]; basePath: string }) {
  const router = useRouter();
  const canChooseAll = stages.length > 1;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stageId, setStageId] = useState<string>(stages.length === 1 ? (stages[0] as string) : "");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [duration, setDuration] = useState(20);
  const [attempts, setAttempts] = useState(1);
  const [mode, setMode] = useState<"questions" | "file">("questions");
  const [maxScore, setMaxScore] = useState(100);
  const [file, setFile] = useState<File | null>(null);
  const [questions, setQuestions] = useState<Question[]>([blank("single_choice")]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const update = (i: number, patch: Partial<Question>) => setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  const updateChoice = (qi: number, ci: number, patch: Partial<Choice>) =>
    setQuestions((qs) =>
      qs.map((q, idx) => {
        if (idx !== qi) return q;
        let choices = q.choices.map((c, j) => (j === ci ? { ...c, ...patch } : c));
        if (patch.correct && q.type !== "multiple_choice") choices = choices.map((c, j) => ({ ...c, correct: j === ci }));
        return { ...q, choices };
      })
    );

  async function submit() {
    setError(null);
    if (!startsAt || !endsAt) return setError("حدّد وقت البداية والنهاية.");
    if (!canChooseAll && !stageId) return setError("المرحلة غير محددة.");
    setBusy(true);
    try {
      let attachmentPath: string | null = null;
      let attachmentName: string | null = null;
      if (mode === "file") {
        if (!file) return setError("ارفع ملف المسابقة (صورة أو PDF).");
        const prep = await prepareQuizAttachmentUploadAction({ name: file.name, type: file.type, size: file.size });
        if ("error" in prep) return setError(prep.error);
        const upErr = await uploadToSigned(prep.path, prep.token, file);
        if (upErr) return setError(upErr);
        attachmentPath = prep.path;
        attachmentName = file.name.slice(0, 150);
      }
      const res = await createQuizAction({
        title,
        description,
        stageId: stageId || null,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        durationMinutes: Number(duration),
        maxAttempts: Number(attempts),
        mode,
        maxScore: mode === "file" ? Number(maxScore) : undefined,
        attachmentPath,
        attachmentName,
        questions: mode === "questions" ? questions : []
      });
      if ("error" in res) return setError(res.error);
      router.push(`${basePath}/${res.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="bg-white rounded-card border border-line p-5 space-y-3">
        <input className={input} placeholder="اسم المسابقة" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className={input} rows={2} placeholder="وصف المسابقة (اختياري)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <label className="block text-sm font-medium">
          المرحلة
          <select className={input} value={stageId} onChange={(e) => setStageId(e.target.value)} disabled={!canChooseAll}>
            {canChooseAll && <option value="">كل المراحل</option>}
            {stages.map((s) => (
              <option key={s} value={s}>{STAGE_LABELS[s]}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">تبدأ في<input type="datetime-local" className={input} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></label>
          <label className="block text-sm font-medium">تنتهي في<input type="datetime-local" className={input} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></label>
          <label className="block text-sm font-medium">مدة الحل (دقيقة)<input type="number" min={1} max={240} className={input} value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></label>
          <label className="block text-sm font-medium">عدد المحاولات<input type="number" min={1} max={10} className={input} value={attempts} onChange={(e) => setAttempts(Number(e.target.value))} /></label>
        </div>
      </div>

      <div className="bg-white rounded-card border border-line p-5">
        <p className="font-bold mb-3">شكل المسابقة</p>
        <div className="flex gap-2">
          {([["questions", "أسئلة داخل التطبيق"], ["file", "ملف (صورة / PDF) والولد يرفع حله"]] as const).map(([m, label]) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-bold ${mode === m ? "bg-primary text-white border-primary" : "border-line text-ink-soft"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === "file" ? (
        <div className="bg-white rounded-card border border-line p-5 space-y-3">
          <label className="block text-sm font-medium">
            ملف المسابقة (صورة أو PDF، حتى 10 ميجا)
            <input type="file" accept={ACCEPT} className={input} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <label className="block text-sm font-medium">
            الدرجة النهائية
            <input type="number" min={1} className={input} value={maxScore} onChange={(e) => setMaxScore(Number(e.target.value))} />
          </label>
          <p className="text-ink-soft text-xs">سيرفع الأولاد حلولهم كصورة أو PDF، وتقوم أنت بتصحيحها وإدخال الدرجة.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q, qi) => (
            <div key={qi} className="bg-white rounded-card border border-line p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold">سؤال {qi + 1}</span>
                {questions.length > 1 && (
                  <button type="button" onClick={() => setQuestions((qs) => qs.filter((_, i) => i !== qi))} className="text-bad text-sm">حذف</button>
                )}
              </div>
              <select className={input} value={q.type} onChange={(e) => update(qi, { ...blank(e.target.value as QType), prompt: q.prompt, points: q.points })}>
                {(Object.keys(TYPE_LABELS) as QType[]).map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
              <textarea className={input} rows={2} placeholder="نص السؤال" value={q.prompt} onChange={(e) => update(qi, { prompt: e.target.value })} />
              {q.type === "true_false" && (
                <div className="flex gap-2">
                  {q.choices.map((c, ci) => (
                    <button key={ci} type="button" onClick={() => updateChoice(qi, ci, { correct: true })} className={`flex-1 rounded-lg border py-2 text-sm font-bold ${c.correct ? "bg-good text-white border-good" : "border-line"}`}>
                      {c.text} {c.correct && "✓ (الصحيحة)"}
                    </button>
                  ))}
                </div>
              )}
              {(q.type === "single_choice" || q.type === "multiple_choice") && (
                <div className="space-y-2">
                  {q.choices.map((c, ci) => (
                    <div key={ci} className="flex items-center gap-2">
                      <input
                        type={q.type === "multiple_choice" ? "checkbox" : "radio"}
                        name={`correct-${qi}`}
                        checked={c.correct}
                        onChange={(e) => updateChoice(qi, ci, { correct: q.type === "multiple_choice" ? e.target.checked : true })}
                        title="الإجابة الصحيحة"
                      />
                      <input className={input} placeholder={`الاختيار ${ci + 1}`} value={c.text} onChange={(e) => updateChoice(qi, ci, { text: e.target.value })} />
                      {q.choices.length > 2 && (
                        <button type="button" onClick={() => update(qi, { choices: q.choices.filter((_, j) => j !== ci) })} className="text-bad">✕</button>
                      )}
                    </div>
                  ))}
                  {q.choices.length < 8 && (
                    <button type="button" onClick={() => update(qi, { choices: [...q.choices, { text: "", correct: false }] })} className="text-primary text-sm font-bold">+ إضافة اختيار</button>
                  )}
                  <p className="text-ink-soft text-xs">علّم على الإجابة الصحيحة{q.type === "multiple_choice" ? " (يمكن أكثر من واحدة)" : ""}.</p>
                </div>
              )}
              {q.type === "text" && <p className="text-ink-soft text-xs">السؤال النصي يُصحَّح يدويًا منك بعد التسليم.</p>}
              <label className="block text-sm font-medium w-32">الدرجة<input type="number" min={1} className={input} value={q.points} onChange={(e) => update(qi, { points: Number(e.target.value) })} /></label>
            </div>
          ))}
          <button type="button" onClick={() => setQuestions((qs) => [...qs, blank("single_choice")])} className="w-full rounded-lg border border-dashed border-primary text-primary font-bold py-3">
            + إضافة سؤال
          </button>
        </div>
      )}

      {error && <p role="alert" className="text-bad text-sm bg-bad/10 rounded-lg px-3 py-2">{error}</p>}
      <button onClick={submit} disabled={busy} className="w-full rounded-lg bg-primary text-white py-3 font-bold disabled:opacity-60">
        {busy ? "جاري الحفظ..." : "إنشاء المسابقة"}
      </button>
    </div>
  );
}
