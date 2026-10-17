"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import {
  updatePrayerSectionAction,
  addPrayerSectionAction,
  deletePrayerSectionAction,
  setPrayerActiveAction,
  type ActionState
} from "./prayerActions";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Icon } from "@/components/ui/Icon";

const initialState: ActionState = { error: null, success: null };
const inputClass = "w-full rounded-lg border border-line px-3.5 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none";

function SaveButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-lg bg-primary text-white px-5 py-2.5 font-bold disabled:opacity-60">
      {pending ? "جاري الحفظ..." : children}
    </button>
  );
}

function Messages({ state }: { state: ActionState }) {
  return (
    <>
      {state.error && <p role="alert" className="text-bad text-sm bg-bad/10 rounded-lg px-3 py-2">{state.error}</p>}
      {state.success && <p role="status" className="text-good text-sm bg-good/10 rounded-lg px-3 py-2">{state.success}</p>}
    </>
  );
}

/** جزء واحد: مقفول افتراضيًا (العنوان بس)، وبيتفتح للتعديل. */
export function PrayerSectionEditor({ number, sectionId, title, body }: { number: number; sectionId: string; title: string; body: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(updatePrayerSectionAction, initialState);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm(`حذف الجزء "${title}" من الصلاة؟ النص المحذوف بيتحفظ في سجل العمليات.`)) return;
    setDeleting(true);
    setDeleteError(null);
    const res = await deletePrayerSectionAction(sectionId);
    setDeleting(false);
    if (res.error) setDeleteError(res.error);
    else router.refresh();
  }

  return (
    <div className="bg-white rounded-card border border-line">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-start"
      >
        <span className="h-8 w-8 flex-none rounded-full bg-[#F4E6D3] text-primary text-sm font-extrabold flex items-center justify-center">
          {number.toLocaleString("ar-EG")}
        </span>
        <span className="flex-1 font-bold text-ink">{title}</span>
        <Icon name="chevronDown" size={18} className={`text-ink-soft transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <form action={formAction} className="px-4 pb-4 space-y-3">
          <input type="hidden" name="section_id" value={sectionId} />
          <label className="block">
            <span className="block text-sm font-medium text-ink mb-1.5">العنوان</span>
            <input name="title_ar" required defaultValue={title} className={inputClass} />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-ink mb-1.5">النص</span>
            <textarea name="body_ar" required defaultValue={body} rows={12} className={`${inputClass} leading-loose text-[15px]`} />
          </label>
          <Messages state={state} />
          {deleteError && <p role="alert" className="text-bad text-sm bg-bad/10 rounded-lg px-3 py-2">{deleteError}</p>}
          <div className="flex items-center justify-between gap-3">
            <SaveButton>حفظ الجزء</SaveButton>
            <button type="button" onClick={remove} disabled={deleting} className="inline-flex items-center gap-1.5 text-sm font-bold text-bad disabled:opacity-50">
              <Icon name="trash" size={15} />
              حذف الجزء
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/** إضافة جزء جديد في آخر الصلاة. */
export function AddPrayerSectionForm({ prayerId }: { prayerId: string }) {
  const [state, formAction] = useFormState(addPrayerSectionAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="bg-white rounded-card border-2 border-dashed border-line p-4 space-y-3 mt-6">
      <h2 className="font-extrabold text-ink">إضافة جزء جديد في آخر الصلاة</h2>
      <input type="hidden" name="prayer_content_id" value={prayerId} />
      <input name="title_ar" required placeholder="العنوان (مثلًا: المزمور الخمسون)" className={inputClass} />
      <textarea name="body_ar" required rows={6} placeholder="الصق نص الجزء من مصدر معتمد..." className={`${inputClass} leading-loose text-[15px]`} />
      <Messages state={state} />
      <SaveButton>إضافة الجزء</SaveButton>
    </form>
  );
}

/** تفعيل/إلغاء تفعيل الصلاة للأولاد. */
export function PrayerActiveToggle({ prayerId, isActive }: { prayerId: string; isActive: boolean }) {
  const router = useRouter();
  const [active, setActive] = useState(isActive);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !active;
    if (!next && !window.confirm("إلغاء تفعيل الصلاة؟ مش هتظهر للأولاد لحد ما تتفعّل تاني.")) return;
    setPending(true);
    setError(null);
    const res = await setPrayerActiveAction(prayerId, next);
    setPending(false);
    if (res.error) setError(res.error);
    else {
      setActive(next);
      router.refresh();
    }
  }

  return (
    <div className="bg-white rounded-card border border-line p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-ink-soft mb-1">ظهورها للأولاد</p>
          {active ? <StatusBadge tone="good">مفعّلة</StatusBadge> : <StatusBadge tone="muted">غير مفعّلة</StatusBadge>}
        </div>
        <button type="button" onClick={toggle} disabled={pending} className="rounded-lg border border-line px-4 py-2 text-sm font-bold disabled:opacity-50">
          {active ? "إلغاء التفعيل" : "تفعيل الصلاة"}
        </button>
      </div>
      {error && <p role="alert" className="text-bad text-sm bg-bad/10 rounded-lg px-3 py-2 mt-3">{error}</p>}
    </div>
  );
}
