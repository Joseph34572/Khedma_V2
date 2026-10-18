"use client";

import { useActionState } from "react";
import { submitQuestionAction, type ActionState } from "@/lib/actions/symposium";
import { ActionForm, useActionFormStatus } from "@/components/ui/ActionForm";

const initial: ActionState = { error: null, success: null };

function Submit() {
  const { pending } = useActionFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-lg bg-primary text-white px-5 py-2.5 font-bold disabled:opacity-60">
      {pending ? "جاري الإرسال..." : "إرسال السؤال"}
    </button>
  );
}

export function AskForm() {
  const [state, action] = useActionState(submitQuestionAction, initial);
  return (
    <ActionForm action={action} key={state.success ?? "form"} className="bg-white rounded-card border border-line p-5 space-y-3 mb-6">
      <textarea
        name="question_text"
        rows={4}
        required
        placeholder="اكتب سؤالك هنا..."
        className="w-full rounded-lg border border-line px-3.5 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
      />
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="is_anonymous" />
        إرسال السؤال بشكل مجهول (لن يظهر اسمك للخدام)
      </label>
      {state.error && <p role="alert" className="text-bad text-sm bg-bad/10 rounded-lg px-3 py-2">{state.error}</p>}
      {state.success && <p className="text-good text-sm bg-good/10 rounded-lg px-3 py-2">{state.success}</p>}
      <Submit />
    </ActionForm>
  );
}
