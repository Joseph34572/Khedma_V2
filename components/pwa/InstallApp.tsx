"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";

// الحدث ده مش في أنواع TypeScript القياسية (Chrome/Edge/Samsung على أندرويد بس).
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "khedma.installBanner.dismissedAt";
const DISMISS_DAYS = 7;

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (ua.includes("Macintosh") && "ontouchend" in document);
}

/**
 * بيسجّل الـ service worker ويلقط حدث "التطبيق قابل للتثبيت" مرة واحدة للتطبيق كله.
 * بيتحط في الـ root layout عشان الحدث ممكن ييجي بدري قبل ما الشريط نفسه يتعرض.
 */
export function PwaSetup() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // لو فشل التسجيل التطبيق شغال عادي، بس مش هيبقى قابل للتثبيت بزرار.
      });
    }
    function onPrompt(e: Event) {
      e.preventDefault(); // بنعرض زرارنا إحنا بدل شريط المتصفح الافتراضي
      deferredPrompt = e as BeforeInstallPromptEvent;
      listeners.forEach((l) => l());
    }
    function onInstalled() {
      deferredPrompt = null;
      listeners.forEach((l) => l());
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return null;
}

/** "android" = فيه زرار تثبيت مباشر، "ios" = خطوات يدوية، null = متثبت أو مش متاح. */
function useInstallMode(): "android" | "ios" | null {
  const [mode, setMode] = useState<"android" | "ios" | null>(null);
  useEffect(() => {
    function update() {
      if (isStandalone()) setMode(null);
      else if (deferredPrompt) setMode("android");
      else if (isIos()) setMode("ios");
      else setMode(null);
    }
    update();
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  return mode;
}

async function promptInstall() {
  if (!deferredPrompt) return;
  await deferredPrompt.prompt();
  await deferredPrompt.userChoice.catch(() => null);
  deferredPrompt = null;
  listeners.forEach((l) => l());
}

function IosSteps() {
  return (
    <ol className="text-[13px] text-ink-soft leading-relaxed list-decimal ps-5 mt-1">
      <li>
        من Safari دوس على زرار المشاركة <ShareGlyph /> تحت.
      </li>
      <li>اختار «إضافة إلى الشاشة الرئيسية» (Add to Home Screen).</li>
    </ol>
  );
}

function ShareGlyph() {
  return (
    <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block align-[-2px]">
      <path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

/** شريط "ثبّت التطبيق" فوق محتوى الصفحة — بيتقفل أسبوع لو داس ✕. */
export function InstallBanner() {
  const mode = useInstallMode();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
      setDismissed(Date.now() - at < DISMISS_DAYS * 86_400_000);
    } catch {
      setDismissed(false);
    }
  }, []);

  if (!mode || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
  }

  return (
    <div role="region" aria-label="تثبيت التطبيق" className="mb-4 bg-white rounded-[20px] border-2 border-gold/60 p-3.5 flex items-start gap-3 shadow-[0_5px_0_#ECDFC8]">
      <span className="h-11 w-11 flex-none rounded-xl bg-primary text-gold flex items-center justify-center">
        <Icon name="cross" size={22} strokeWidth={2.4} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-extrabold text-ink text-[15px]">ثبّت التطبيق على شاشتك الرئيسية</p>
        {mode === "android" ? (
          <p className="text-[13px] text-ink-soft mt-0.5">يفتح بملء الشاشة زي أي تطبيق، من غير شريط المتصفح.</p>
        ) : (
          <IosSteps />
        )}
        {mode === "android" && (
          <button type="button" onClick={promptInstall} className="mt-2.5 h-10 px-4 rounded-[12px] bg-primary text-parchment text-sm font-extrabold">
            تثبيت التطبيق
          </button>
        )}
      </div>
      <button type="button" onClick={dismiss} aria-label="إخفاء" className="h-9 w-9 flex-none rounded-full text-ink-soft hover:bg-parchment flex items-center justify-center">
        <Icon name="x" size={18} />
      </button>
    </div>
  );
}

/** كارت دائم في صفحة الملف الشخصي (مفيش ✕) — لو حد قفل الشريط ويحب يثبّت بعدين. */
export function InstallCard() {
  const mode = useInstallMode();
  if (!mode) return null;
  return (
    <section className="mt-4 bg-white rounded-[24px] border-2 border-line p-4 shadow-[0_6px_0_#ECDFC8]">
      <p className="font-extrabold text-ink">ثبّت التطبيق على شاشتك الرئيسية</p>
      {mode === "android" ? (
        <>
          <p className="text-[13px] text-ink-soft mt-0.5">يفتح بملء الشاشة زي أي تطبيق، من غير شريط المتصفح.</p>
          <button type="button" onClick={promptInstall} className="mt-3 w-full h-12 rounded-[14px] bg-primary text-parchment font-extrabold">
            تثبيت التطبيق
          </button>
        </>
      ) : (
        <IosSteps />
      )}
    </section>
  );
}
