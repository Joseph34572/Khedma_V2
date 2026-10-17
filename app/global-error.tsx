"use client";

import { useEffect } from "react";

/**
 * error.tsx بيمسك أي خطأ في الصفحات العادية، لكن ميقدرش يمسك خطأ يحصل في
 * app/layout.tsx نفسه (التخطيط الجذري) — ده محتاج global-error.tsx تحديدًا،
 * وبما إنه بيستبدل التخطيط الجذري بالكامل وقت الخطأ، لازم يملك <html>/<body>
 * الخاصين بيه (التخطيط الأصلي مش موجود وقت ما الخطأ ده بيظهر).
 */
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled root layout error", { digest: error.digest });
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body className="font-sans antialiased">
        <main className="min-h-screen flex items-center justify-center p-6 text-center">
          <div>
            <h1 className="text-2xl font-extrabold text-ink mb-2">حدث خطأ غير متوقَّع</h1>
            <p className="text-ink-soft mb-2">برجاء المحاولة مرة أخرى. لو المشكلة استمرت، تواصل مع أمين الخدمة.</p>
            {error.digest && <p className="text-xs text-ink-soft mb-6" dir="ltr">رمز المرجع: {error.digest}</p>}
            <button onClick={() => reset()} className="inline-block rounded-lg bg-primary text-white px-5 py-2.5 font-bold">
              إعادة المحاولة
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
