"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { startPrayerSessionAction, finishPrayerSessionAction } from "@/lib/actions/prayer";

export function PrayerRunner({ prayerContentId, title, body, backHref }: { prayerContentId: string; title: string; body: string; backHref: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "running" | "paused" | "done">("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const maxProgressRef = useRef(0);
  const stateRef = useRef({ phase, sessionId, activeSeconds, progress });
  stateRef.current = { phase, sessionId, activeSeconds, progress };

  // لو غادر المستخدم الصفحة قبل إنهاء الجلسة، تُسجَّل الجلسة كـ"متروكة" بدل ما تفضل معلّقة بلا نهاية
  useEffect(() => {
    return () => {
      const s = stateRef.current;
      if ((s.phase === "running" || s.phase === "paused") && s.sessionId) {
        finishPrayerSessionAction({
          sessionId: s.sessionId,
          activeSeconds: s.activeSeconds,
          progressPercent: s.progress,
          abandoned: true
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // عداد الوقت النشط: يعمل فقط أثناء التشغيل الفعلي، ويتوقف تلقائيًا لو الصفحة غير ظاهرة (تبديل تطبيق مثلًا)
  useEffect(() => {
    if (phase !== "running") return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        setActiveSeconds((s) => s + 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  function handleScroll() {
    const el = contentRef.current;
    if (!el) return;
    const scrollable = el.scrollHeight - el.clientHeight;
    const pct = scrollable <= 0 ? 100 : Math.round((el.scrollTop / scrollable) * 100);
    if (pct > maxProgressRef.current) {
      maxProgressRef.current = pct;
      setProgress(pct);
    }
  }

  async function handleStart() {
    setError(null);
    const result = await startPrayerSessionAction(prayerContentId);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setSessionId(result.sessionId);
    // لو الولد دخل نفس الصلاة قبل كده النهارده، نكمّل العدّ من الوقت المتراكم
    // بدل ما نبدأ من صفر (log واحدة باليوم، والوقت تراكمي).
    setActiveSeconds(result.priorActiveSeconds);
    setPhase("running");
  }

  async function handleFinish(abandoned = false) {
    if (!sessionId) return;
    const result = await finishPrayerSessionAction({ sessionId, activeSeconds, progressPercent: progress, abandoned });
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setPhase("done");
  }

  if (phase === "idle") {
    return (
      <div className="max-w-xl">
        <h1 className="text-xl font-extrabold text-ink mb-2">{title}</h1>
        <div className="bg-white rounded-card border border-line p-6 text-center">
          <p className="text-ink-soft mb-5">اضغط ابدأ عندما تكون مستعدًا للصلاة.</p>
          <button onClick={handleStart} className="rounded-lg bg-primary text-white px-6 py-3 font-bold">
            ابدأ الصلاة
          </button>
          {error && <p className="text-bad text-sm mt-3">{error}</p>}
        </div>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="max-w-xl text-center">
        <div className="bg-white rounded-card border border-line p-8">
          <p className="text-3xl mb-3">✅</p>
          <h1 className="text-lg font-extrabold text-ink mb-1">تم تسجيل الجلسة</h1>
          <p className="text-ink-soft text-sm">الوقت النشط: {Math.round(activeSeconds / 60)} دقيقة</p>
          <a href={backHref} className="inline-block mt-5 text-primary font-bold">رجوع لقائمة الصلوات</a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-extrabold text-ink">{title}</h1>
      </div>

      <div
        ref={contentRef}
        onScroll={handleScroll}
        className="bg-white rounded-card border border-line p-5 leading-loose text-ink whitespace-pre-line max-h-[55vh] overflow-y-auto"
      >
        {body}
      </div>

      <div className="flex gap-2 mt-4">
        {phase === "running" ? (
          <button onClick={() => setPhase("paused")} className="flex-1 rounded-lg border border-line py-3 font-bold">
            ⏸ توقف
          </button>
        ) : (
          <button onClick={() => setPhase("running")} className="flex-1 rounded-lg border border-line py-3 font-bold">
            ▶ استكمال
          </button>
        )}
        <button onClick={() => handleFinish(false)} className="flex-1 rounded-lg bg-primary text-white py-3 font-bold">
          إنهاء الصلاة
        </button>
      </div>
      {error && <p className="text-bad text-sm mt-3">{error}</p>}
    </div>
  );
}
