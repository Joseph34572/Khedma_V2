"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { prepareAnswerUploadAction, finalizeAnswerUploadAction } from "@/lib/actions/quizzes";
import { uploadToSigned, ACCEPT } from "./upload";

export function FileSubmit({ quizId, basePath }: { quizId: string; basePath: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!file) return setError("اختر ملف الحل أولًا (صورة أو PDF).");
    setBusy(true);
    setError(null);
    const prep = await prepareAnswerUploadAction(quizId, { name: file.name, type: file.type, size: file.size });
    if ("error" in prep) {
      setBusy(false);
      return setError(prep.error);
    }
    const upErr = await uploadToSigned(prep.path, prep.token, file);
    if (upErr) {
      setBusy(false);
      return setError(upErr);
    }
    const fin = await finalizeAnswerUploadAction(prep.attemptId, prep.path, file.name);
    setBusy(false);
    if ("error" in fin) return setError(fin.error);
    router.push(basePath);
  }

  return (
    <div className="bg-white rounded-card border border-line p-5 space-y-3">
      <input type="file" accept={ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full rounded-lg border border-line px-3 py-2.5" />
      {error && <p className="text-bad text-sm bg-bad/10 rounded-lg px-3 py-2">{error}</p>}
      <button onClick={submit} disabled={busy} className="w-full rounded-lg bg-primary text-white py-3 font-bold disabled:opacity-60">
        {busy ? "جاري الرفع..." : "رفع حل المسابقة"}
      </button>
      <p className="text-ink-soft text-xs">صورة (JPG/PNG/WEBP) أو PDF، بحد أقصى 10 ميجابايت.</p>
    </div>
  );
}
