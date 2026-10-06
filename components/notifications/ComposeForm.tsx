"use client";

import { useFormState, useFormStatus } from "react-dom";
import { sendNotificationAction, type ComposeState } from "@/lib/actions/notifications";
import { type AudienceSegment } from "@/lib/audienceSegments";
import { STAGE_LABELS, STAGE_ORDER, type Stage } from "@/lib/roles";

const initialState: ComposeState = { error: null, success: null };
const inputClass = "w-full rounded-lg border border-line px-3.5 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none";

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-lg bg-primary text-white px-5 py-2.5 font-bold disabled:opacity-60">
      {pending ? "جاري الإرسال..." : "إرسال الإشعار"}
    </button>
  );
}

function Checkbox({ value, label }: { value: AudienceSegment; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm bg-parchment/50 rounded-lg px-3 py-2 border border-line cursor-pointer">
      <input type="checkbox" name="segments" value={value} className="w-4 h-4" />
      {label}
    </label>
  );
}

/** نموذج الإرسال: لمدير عام/أمين عام يرى كل الفئات (كل المراحل + الأدوار الإدارية)،
 * ولأمين الخدمة يرى فقط أولاد وخدام مرحلته. */
export function ComposeForm({ scope, myStage }: { scope: "global" | "stage"; myStage?: Stage | null }) {
  const [state, formAction] = useFormState(sendNotificationAction, initialState);

  const stagesToShow: Stage[] = scope === "global" ? STAGE_ORDER : myStage ? [myStage] : [];

  return (
    <form action={formAction} className="bg-white rounded-card border border-line p-5 space-y-4 mb-6">
      <h2 className="font-bold text-ink">إرسال إشعار جديد</h2>

      <label className="block">
        <span className="block mb-1.5 text-sm font-medium text-ink">العنوان</span>
        <input name="title" required className={inputClass} />
      </label>

      <label className="block">
        <span className="block mb-1.5 text-sm font-medium text-ink">نص الإشعار</span>
        <textarea name="body" rows={4} required className={inputClass} />
      </label>

      <label className="block">
        <span className="block mb-1.5 text-sm font-medium text-ink">رابط (اختياري)</span>
        <input name="link_url" type="url" placeholder="https://..." className={inputClass} />
      </label>

      <div>
        <span className="block mb-2 text-sm font-medium text-ink">الفئات المستهدفة</span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {scope === "global" && <Checkbox value="all" label="الجميع" />}

          {stagesToShow.map((stage) => (
            <Checkbox key={`member:${stage}`} value={`member:${stage}`} label={`أولاد ${STAGE_LABELS[stage]}`} />
          ))}
          {stagesToShow.map((stage) => (
            <Checkbox key={`servant:${stage}`} value={`servant:${stage}`} label={`خدام ${STAGE_LABELS[stage]}`} />
          ))}
          {scope === "global" &&
            stagesToShow.map((stage) => (
              <Checkbox key={`stage_secretary:${stage}`} value={`stage_secretary:${stage}`} label={`أمناء ${STAGE_LABELS[stage]}`} />
            ))}
          {scope === "global" && <Checkbox value="general_secretary" label="أمين عام" />}
          {scope === "global" && <Checkbox value="super_admin" label="مدير عام" />}
        </div>
        <p className="text-xs text-ink-soft mt-1.5">اختيار "الجميع" يتجاهل باقي الفئات المحدَّدة.</p>
      </div>

      <label className="block">
        <span className="block mb-1.5 text-sm font-medium text-ink">أو أرقام هواتف محددة (رقم في كل سطر، اختياري)</span>
        <textarea name="specific_phones" rows={3} placeholder={"01012345678\n01087654321"} dir="ltr" className={`${inputClass} font-normal`} />
      </label>

      {state.error && <p className="text-bad text-sm bg-bad/10 rounded-lg px-3 py-2">{state.error}</p>}
      {state.success && <p className="text-good text-sm bg-good/10 rounded-lg px-3 py-2">{state.success}</p>}
      <SendButton />
    </form>
  );
}
