"use client";

import { useState, useTransition } from "react";
import { setQuestionStatusAction, assignQuestionAction, addQuestionNoteAction } from "@/lib/actions/symposium";
import { QUESTION_STATUS_LABELS } from "./labels";
import type { QuestionStatus } from "@/types/database";

export function ManagePanel({
  questionId,
  status,
  assignedTo,
  servants,
  notes
}: {
  questionId: string;
  status: QuestionStatus;
  assignedTo: string | null;
  servants: { id: string; full_name: string }[];
  notes: { id: string; note: string; author_name: string; created_at: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [note, setNote] = useState("");

  function run(fn: () => Promise<{ error?: string }>, after?: () => void) {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) setMsg(r.error);
      else after?.();
    });
  }

  const sel = "w-full rounded-lg border border-line px-3 py-2.5 bg-white";
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-card border border-line p-5 space-y-3">
        <label className="block text-sm font-medium">
          الحالة
          <select className={sel} defaultValue={status} disabled={pending} onChange={(e) => run(() => setQuestionStatusAction(questionId, e.target.value))}>
            {(Object.keys(QUESTION_STATUS_LABELS) as QuestionStatus[]).map((s) => (
              <option key={s} value={s}>{QUESTION_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          تعيين لخادم
          <select className={sel} defaultValue={assignedTo ?? ""} disabled={pending} onChange={(e) => run(() => assignQuestionAction(questionId, e.target.value))}>
            <option value="">— غير معيّن —</option>
            {servants.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="bg-white rounded-card border border-line p-5">
        <h2 className="font-bold text-ink mb-3">ملاحظات داخلية</h2>
        <div className="space-y-2 mb-3">
          {notes.map((n) => (
            <div key={n.id} className="bg-parchment/60 rounded-lg px-3 py-2 text-sm">
              <p>{n.note}</p>
              <p className="text-ink-soft text-xs mt-1">{n.author_name}</p>
            </div>
          ))}
          {notes.length === 0 && <p className="text-ink-soft text-sm">لا توجد ملاحظات بعد.</p>}
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="أضف ملاحظة للخدام..." className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
        <button
          disabled={pending || !note.trim()}
          onClick={() => run(() => addQuestionNoteAction(questionId, note), () => { setNote(""); window.location.reload(); })}
          className="mt-2 rounded-lg bg-primary text-white px-4 py-2 text-sm font-bold disabled:opacity-60"
        >
          إضافة ملاحظة
        </button>
      </div>
      {msg && <p className="text-bad text-sm bg-bad/10 rounded-lg px-3 py-2">{msg}</p>}
    </div>
  );
}
