"use client";

import { useFormState, useFormStatus } from "react-dom";
import { importChapterAction, type ImportChapterState } from "@/lib/actions/bible";

const initialState: ImportChapterState = { error: null, success: null };
const inputClass = "w-full rounded-lg border border-line px-3.5 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-lg bg-primary text-white px-5 py-2.5 font-bold disabled:opacity-60">
      {pending ? "جاري الاستيراد..." : "استيراد الإصحاح"}
    </button>
  );
}

export function ImportChapterForm({ books }: { books: { id: number; name_ar: string; testament: string }[] }) {
  const [state, formAction] = useFormState(importChapterAction, initialState);

  return (
    <form action={formAction} className="bg-white rounded-card border border-line p-5 space-y-4">
      <label className="block">
        <span className="block mb-1.5 text-sm font-medium text-ink">السفر</span>
        <select name="book_id" required className={inputClass}>
          {books.map((b) => (
            <option key={b.id} value={b.id}>{b.name_ar}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="block mb-1.5 text-sm font-medium text-ink">رقم الإصحاح</span>
        <input name="chapter_number" type="number" min={1} required className={inputClass} />
      </label>
      <label className="block">
        <span className="block mb-1.5 text-sm font-medium text-ink">نص الآيات (آية في كل سطر)</span>
        <textarea name="verses_text" rows={10} required dir="rtl" className={`${inputClass} font-normal leading-relaxed`} />
      </label>

      {state.error && <p className="text-bad text-sm bg-bad/10 rounded-lg px-3 py-2">{state.error}</p>}
      {state.success && <p className="text-good text-sm bg-good/10 rounded-lg px-3 py-2">{state.success}</p>}

      <SubmitButton />
    </form>
  );
}
