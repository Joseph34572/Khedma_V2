"use client";

import { useEffect, useRef, useState } from "react";
import { scanAttendanceAction } from "@/lib/actions/qr";

type LogEntry = { text: string; tone: "good" | "bad" };

export function QrScanner({ kind, entityId }: { kind: "mass" | "sunday_school"; entityId: string }) {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const lastScan = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const busy = useRef(false);
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);

  async function handleDecode(code: string) {
    const now = Date.now();
    if (busy.current || (code === lastScan.current.code && now - lastScan.current.at < 5000)) return;
    busy.current = true;
    lastScan.current = { code, at: now };
    const result = await scanAttendanceAction(kind, entityId, code);
    const entry: LogEntry =
      "ok" in result ? { text: `✅ تم تسجيل حضور ${result.name}`, tone: "good" } : { text: `⚠️ ${result.error}`, tone: "bad" };
    setLog((prev) => [entry, ...prev].slice(0, 15));
    if (navigator.vibrate) navigator.vibrate("ok" in result ? 80 : [80, 60, 80]);
    setTimeout(() => (busy.current = false), 1200);
  }

  async function start() {
    setError(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 240, height: 240 } }, handleDecode, () => {});
      setStarted(true);
    } catch {
      setError("تعذّر فتح الكاميرا. تأكد من السماح للتطبيق باستخدام الكاميرا وأن الموقع يعمل عبر HTTPS.");
    }
  }

  useEffect(() => {
    return () => {
      scannerRef.current?.stop().then(() => scannerRef.current?.clear()).catch(() => {});
    };
  }, []);

  return (
    <div>
      <div id="qr-reader" className="rounded-card overflow-hidden border border-line bg-white min-h-[120px]" />
      {!started && (
        <button onClick={start} className="w-full mt-3 rounded-lg bg-primary text-white py-3 font-bold">
          📷 فتح الكاميرا
        </button>
      )}
      {error && <p className="text-bad text-sm mt-3 bg-bad/10 rounded-lg px-3 py-2">{error}</p>}
      <div className="mt-4 space-y-2">
        {log.map((e, i) => (
          <p key={i} className={`text-sm rounded-lg px-3 py-2 ${e.tone === "good" ? "bg-good/10 text-good" : "bg-bad/10 text-bad"}`}>
            {e.text}
          </p>
        ))}
      </div>
    </div>
  );
}
