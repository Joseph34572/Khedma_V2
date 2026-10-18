"use client";

import { createContext, forwardRef, useContext, useTransition, type FormHTMLAttributes, type SubmitEvent as ReactSubmitEvent } from "react";
import { useFormStatus } from "react-dom";

const PendingContext = createContext(false);

type Props = Omit<FormHTMLAttributes<HTMLFormElement>, "action"> & {
  action: (formData: FormData) => void;
};

/**
 * فورم بيبعت لـ Server Action زي <form action> بالظبط، بس من غير ما يفضّي الحقول
 * بعد الإرسال. React 19 بقى بيعمل reset تلقائي لأي <form action={...}> بعد ما
 * الإجراء يخلص — يعني لو حصل خطأ وانت بتعدّل نص صلاة طويل أو بتستورد إصحاح،
 * كل اللي كتبته كان هيضيع. هنا الحقول بتفضل زي ما هي، والفورم اللي محتاج يتفضّى
 * بعد النجاح بيعمل كده بنفسه (زي ما كان قبل كده).
 */
export const ActionForm = forwardRef<HTMLFormElement, Props>(function ActionForm({ action, onSubmit: beforeSubmit, children, ...rest }, ref) {
  const [pending, startTransition] = useTransition();

  function onSubmit(e: ReactSubmitEvent<HTMLFormElement>) {
    // onSubmit الخارجي (زي رسالة تأكيد الحذف) يقدر يلغي الإرسال بـ preventDefault.
    beforeSubmit?.(e);
    if (e.defaultPrevented) return;
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    let formData: FormData;
    try {
      formData = new FormData(e.currentTarget, submitter);
    } catch {
      formData = new FormData(e.currentTarget);
    }
    startTransition(() => action(formData));
  }

  return (
    <PendingContext.Provider value={pending}>
      <form ref={ref} {...rest} onSubmit={onSubmit}>
        {children}
      </form>
    </PendingContext.Provider>
  );
});

/** بديل useFormStatus جوّه ActionForm (وبيشتغل كمان جوّه <form action> العادي). */
export function useActionFormStatus(): { pending: boolean } {
  const inActionForm = useContext(PendingContext);
  const { pending } = useFormStatus();
  return { pending: inActionForm || pending };
}
