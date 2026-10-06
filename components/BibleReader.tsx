"use client";

import { useEffect, useRef, useState } from "react";
import { startReadingSessionAction, finishReadingSessionAction } from "@/lib/actions/bible";

export function BibleReader({
  chapterId,
  bookName,
  chapterNumber,
  verses,
  backHref
}: {
  chapterId: string;
  bookName: string;
  chapterNumber: number;
  verses: { verse_number: number; text_ar: string }[];
  backHref: string;
}) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const maxProgressRef = useRef(0);
  const stateRef = useRef({ sessionId, activeSeconds, progress, done });
  stateRef.current = { sessionId, activeSeconds, progress, done };

  useEffect(() => {
    startReadingSessionAction(chapterId).then((r) => {
      if ("sessionId" in r) setSessionId(r.sessionId);
      else setError(r.error);
    });
  }, [chapterId]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && !stateRef.current.done) {
        setActiveSeconds((s) => s + 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      const s = stateRef.current;
      if (!s.done && s.sessionId) {
        finishReadingSessionAction({ sessionId: s.sessionId, activeSeconds: s.activeSeconds, progressPercent: s.progress, abandoned: true });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function handleFinish() {
    if (!sessionId) return;
    const result = await finishReadingSessionAction({ sessionId, activeSeconds, progressPercent: Math.max(progress, 90) });
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="max-w-xl text-center">
        <div className="bg-white rounded-card border border-line p-8">
          <p className="text-3xl mb-3">✅</p>
          <h1 className="text-lg font-extrabold text-ink mb-1">تم تسجيل جلسة القراءة</h1>
          <a href={backHref} className="inline-block mt-4 text-primary font-bold">رجوع</a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-lg font-extrabold text-ink mb-3">{bookName} — إصحاح {chapterNumber}</h1>
      <div
        ref={contentRef}
        onScroll={handleScroll}
        className="bg-white rounded-card border border-line p-5 leading-loose text-ink max-h-[60vh] overflow-y-auto"
      >
        {verses.map((v) => (
          <p key={v.verse_number} className="mb-2">
            <span className="text-gold-dark font-bold ms-1">{v.verse_number}</span> {v.text_ar}
          </p>
        ))}
      </div>
      <button onClick={handleFinish} className="w-full mt-4 rounded-lg bg-primary text-white py-3 font-bold">
        تم الانتهاء من القراءة
      </button>
      {error && <p className="text-bad text-sm mt-3">{error}</p>}
    </div>
  );
}
