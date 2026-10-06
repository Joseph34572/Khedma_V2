"use client";

import { useState } from "react";
import { getQuizAttachmentUrlAction, getAnswerFileUrlAction } from "@/lib/actions/quizzes";

export function DownloadButton({ kind, id, label }: { kind: "attachment" | "answer"; id: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function open() {
    setBusy(true);
    setErr(null);
    const r = kind === "attachment" ? await getQuizAttachmentUrlAction(id) : await getAnswerFileUrlAction(id);
    setBusy(false);
    if ("error" in r) setErr(r.error);
    else window.open(r.url, "_blank", "noopener");
  }
  return (
    <span>
      <button onClick={open} disabled={busy} className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-bold text-primary hover:border-primary disabled:opacity-60">
        {busy ? "..." : `📎 ${label}`}
      </button>
      {err && <span className="text-bad text-xs ms-2">{err}</span>}
    </span>
  );
}
