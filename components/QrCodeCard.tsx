"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrCodeCard({ token }: { token: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(`khedma:${token}`, { width: 280, margin: 2, errorCorrectionLevel: "M" }).then(setSrc);
  }, [token]);
  return (
    <div className="bg-white rounded-card border border-line p-6 text-center">
      {src ? <img src={src} alt="رمز الاستجابة السريعة الخاص بك" className="mx-auto w-64 h-64" /> : <p className="text-ink-soft">جاري التحميل...</p>}
      <p className="text-ink-soft text-xs mt-3">اعرض هذا الرمز للخادم عند تسجيل الحضور. لا تشاركه مع أحد.</p>
    </div>
  );
}
