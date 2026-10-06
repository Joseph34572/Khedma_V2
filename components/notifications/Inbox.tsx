"use client";

import { useState, useTransition } from "react";
import { markNotificationReadAction } from "@/lib/actions/notifications";
import { relativeArabicDate } from "@/lib/format";
import type { InboxItem } from "./InboxQuery";

export function Inbox({ items }: { items: InboxItem[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [readMap, setReadMap] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();

  function handleOpen(item: InboxItem) {
    const willExpand = expandedId !== item.recipientId;
    setExpandedId(willExpand ? item.recipientId : null);
    if (willExpand && !item.readAt && !readMap[item.recipientId]) {
      setReadMap((prev) => ({ ...prev, [item.recipientId]: true }));
      startTransition(() => {
        markNotificationReadAction(item.recipientId);
      });
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-ink-soft text-center py-10">لا توجد إشعارات حتى الآن.</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const isRead = Boolean(item.readAt) || readMap[item.recipientId];
        const isExpanded = expandedId === item.recipientId;
        return (
          <li key={item.recipientId} className="bg-white rounded-card border border-line overflow-hidden">
            <button
              type="button"
              onClick={() => handleOpen(item)}
              className="w-full text-right px-4 py-3 flex items-center justify-between gap-3"
            >
              <span className="flex items-center gap-2 min-w-0">
                {!isRead && <span className="w-2 h-2 rounded-full bg-primary shrink-0" aria-hidden />}
                <span className={`truncate ${isRead ? "text-ink-soft" : "font-bold text-ink"}`}>{item.title}</span>
              </span>
              <span className="text-xs text-ink-soft shrink-0">{relativeArabicDate(item.sentAt)}</span>
            </button>
            {isExpanded && (
              <div className="px-4 pb-4 text-sm text-ink-soft border-t border-line pt-3">
                <p className="whitespace-pre-wrap">{item.body}</p>
                {item.linkUrl && (
                  <a href={item.linkUrl} className="inline-block mt-2 text-primary font-bold hover:underline">
                    فتح الرابط ←
                  </a>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
