"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { startPrayerSessionAction, finishPrayerSessionAction } from "@/lib/actions/prayer";

export type AgpeyaSection = { id: string; title: string; body: string };

const FONT_SIZES = [18, 20, 23, 26, 30];
const FONT_KEY = "khedma.agpeya.fontSize";
const SWIPE_MIN_PX = 60;

/**
 * قارئ الأجبية: قايمة بأجزاء الساعة (الولد بيختار يبدأ منين)، وبعدين قراءة جزء جزء
 * مع التنقل بالسحب يمين/شمال أو بالزراير. الوقت النشط بيتحسب للصلاة كلها (جلسة
 * واحدة في اليوم لكل صلاة، تراكمية) بنفس قواعد PrayerRunner: الاكتمال بعد 5 دقايق
 * وقت نشط، والعدّاد بيقف لو الصفحة مش ظاهرة.
 */
export function AgpeyaReader({
  prayerContentId,
  title,
  sections,
  backHref
}: {
  prayerContentId: string;
  title: string;
  sections: AgpeyaSection[];
  backHref: string;
}) {
  const [index, setIndex] = useState<number | null>(null); // null = قايمة الأجزاء
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fontIdx, setFontIdx] = useState(1);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const stateRef = useRef({ sessionId, activeSeconds, done, reading: index !== null });
  stateRef.current = { sessionId, activeSeconds, done, reading: index !== null };

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(FONT_KEY));
      if (saved >= 0 && saved < FONT_SIZES.length) setFontIdx(saved);
    } catch {
      // التخزين المحلي ممكن يكون مقفول (وضع خاص) — نكمّل بالحجم الافتراضي.
    }
  }, []);

  function changeFont(delta: number) {
    setFontIdx((i) => {
      const next = Math.min(FONT_SIZES.length - 1, Math.max(0, i + delta));
      try {
        localStorage.setItem(FONT_KEY, String(next));
      } catch {}
      return next;
    });
  }

  // عدّاد الوقت النشط: أثناء القراءة فقط، ولما الصفحة ظاهرة.
  useEffect(() => {
    if (index === null || done || !sessionId) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") setActiveSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [index, done, sessionId]);

  // لو خرج من الصفحة من غير "إنهاء"، الجلسة بتتسجّل متروكة بالوقت اللي اتحسب.
  useEffect(() => {
    return () => {
      const s = stateRef.current;
      if (s.sessionId && !s.done) {
        finishPrayerSessionAction({ sessionId: s.sessionId, activeSeconds: s.activeSeconds, progressPercent: 0, abandoned: true });
      }
    };
  }, []);

  async function open(i: number) {
    setError(null);
    if (!sessionId) {
      const res = await startPrayerSessionAction(prayerContentId);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setSessionId(res.sessionId);
      setActiveSeconds(res.priorActiveSeconds);
    }
    setDirection("next");
    setIndex(i);
    window.scrollTo({ top: 0 });
  }

  // قفل القايمة المنسدلة لو داس برّه منها.
  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [menuOpen]);

  function jump(i: number) {
    setMenuOpen(false);
    if (index === null || i === index) return;
    setDirection(i > index ? "next" : "prev");
    setIndex(i);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function go(delta: 1 | -1) {
    if (index === null) return;
    const next = index + delta;
    if (next < 0 || next >= sections.length) return;
    setDirection(delta === 1 ? "next" : "prev");
    setIndex(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function finish() {
    if (!sessionId) return;
    const progress = index === null ? 0 : Math.round(((index + 1) / sections.length) * 100);
    const res = await finishPrayerSessionAction({ sessionId, activeSeconds, progressPercent: progress });
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setDone(true);
  }

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    if (t) touch.current = { x: t.clientX, y: t.clientY };
  }

  function onTouchEnd(e: React.TouchEvent) {
    const start = touch.current;
    const t = e.changedTouches[0];
    touch.current = null;
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    // التطبيق عربي (من اليمين للشمال): السحب ناحية اليمين = الجزء اللي بعده، زي قلب صفحة كتاب عربي.
    go(dx > 0 ? 1 : -1);
  }

  if (done) {
    return (
      <div className="max-w-xl mx-auto text-center">
        <div className="bg-white rounded-card border border-line p-8">
          <span className="mb-3 inline-flex text-good">
            <Icon name="checkCircle" size={44} />
          </span>
          <h1 className="text-lg font-extrabold text-ink mb-1">تم تسجيل الصلاة</h1>
          <p className="text-ink-soft text-sm">الوقت النشط: {Math.round(activeSeconds / 60).toLocaleString("ar-EG")} دقيقة</p>
          <Link href={backHref} prefetch={false} className="inline-block mt-5 text-primary font-bold">
            رجوع للصلوات
          </Link>
        </div>
      </div>
    );
  }

  // ---------------- قايمة الأجزاء ----------------
  if (index === null) {
    return (
      <div className="max-w-xl mx-auto">
        <Link href={backHref} prefetch={false} className="text-sm text-ink-soft hover:underline">
          ‹ كل الصلوات
        </Link>
        <h1 className="text-xl font-extrabold text-ink mt-2">{title}</h1>
        <p className="text-ink-soft text-sm mt-1 mb-4">اختار الجزء اللي تبدأ منه، وبعدين اسحب يمين وشمال للتنقل بين الأجزاء.</p>

        <button
          type="button"
          onClick={() => open(0)}
          className="w-full h-[56px] rounded-[18px] bg-primary text-parchment text-base font-extrabold mb-4"
        >
          ابدأ الصلاة من الأول
        </button>
        {sessionId && (
          <button
            type="button"
            onClick={finish}
            className="w-full h-[52px] rounded-[18px] bg-gold text-ink text-base font-extrabold mb-4"
          >
            إنهاء الصلاة
          </button>
        )}
        {error && <p role="alert" className="text-bad text-sm mb-3">{error}</p>}

        <ol className="bg-white rounded-card border border-line divide-y divide-line overflow-hidden">
          {sections.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => open(i)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-start hover:bg-parchment"
              >
                <span className="h-8 w-8 flex-none rounded-full bg-[#F4E6D3] text-primary text-sm font-extrabold flex items-center justify-center">
                  {(i + 1).toLocaleString("ar-EG")}
                </span>
                <span className="flex-1 font-bold text-ink">{s.title}</span>
                <Icon name="chevronLeft" size={18} className="text-ink-soft" />
              </button>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  // ---------------- قراءة جزء ----------------
  const section = sections[index];
  if (!section) return null;
  const isLast = index === sections.length - 1;

  return (
    <div className="max-w-2xl mx-auto" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="flex items-start gap-2 mb-4">
        {/* قايمة منسدلة باسم الصلاة: بتعرض كل أجزاءها والولد بيروح لأي جزء على طول. */}
        <div ref={menuRef} className="relative flex-1 min-w-0">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="w-full h-11 rounded-[14px] bg-primary text-parchment px-4 flex items-center justify-between gap-2 font-extrabold"
          >
            <span className="truncate">{title}</span>
            <Icon name="chevronDown" size={18} strokeWidth={2.5} className={`transition-transform ${menuOpen ? "rotate-180" : ""}`} />
          </button>
          {menuOpen && (
            <ul
              role="listbox"
              aria-label={`أجزاء ${title}`}
              className="absolute z-20 inset-x-0 mt-2 max-h-[60vh] overflow-y-auto rounded-[14px] border border-line bg-white shadow-[0_12px_30px_rgba(46,33,23,0.18)] divide-y divide-line"
            >
              {sections.map((s, i) => (
                <li key={s.id} role="option" aria-selected={i === index}>
                  <button
                    type="button"
                    onClick={() => jump(i)}
                    className={`w-full text-start px-4 py-3 text-[15px] ${
                      i === index ? "bg-[#F4E6D3] font-extrabold text-primary" : "text-ink hover:bg-parchment"
                    }`}
                  >
                    {s.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <span className="inline-flex items-center gap-1 flex-none">
          <button type="button" aria-label="تصغير الخط" onClick={() => changeFont(-1)} className="h-11 w-11 rounded-full border border-line bg-white text-sm font-bold">
            ا-
          </button>
          <button type="button" aria-label="تكبير الخط" onClick={() => changeFont(1)} className="h-11 w-11 rounded-full border border-line bg-white text-base font-bold">
            ا+
          </button>
        </span>
      </div>

      <article
        key={section.id}
        className={`bg-white rounded-card border border-line p-5 ${direction === "next" ? "agpeya-in-next" : "agpeya-in-prev"}`}
      >
        <h1 className="text-xl font-extrabold text-primary mb-4">{section.title}</h1>
        <div className="text-ink whitespace-pre-line leading-[2.1]" style={{ fontSize: FONT_SIZES[fontIdx] }}>
          {section.body}
        </div>
      </article>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={index === 0}
          className="h-[52px] rounded-[16px] border-2 border-line bg-white font-bold text-ink disabled:opacity-40"
        >
          › السابق
        </button>
        {isLast ? (
          <button type="button" onClick={finish} className="h-[52px] rounded-[16px] bg-primary text-parchment font-extrabold">
            إنهاء الصلاة
          </button>
        ) : (
          <button type="button" onClick={() => go(1)} className="h-[52px] rounded-[16px] bg-primary text-parchment font-extrabold">
            التالي ‹
          </button>
        )}
      </div>
      {error && <p role="alert" className="text-bad text-sm mt-3">{error}</p>}
    </div>
  );
}
