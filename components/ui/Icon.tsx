// أيقونات خطّية موحّدة (نفس أسلوب تصميم "حيوي") بدل الـ emoji: شكلها ثابت على كل
// الأجهزة وبتاخد لون النص اللي حواليها (currentColor). ملف عادي من غير "use client"
// عشان يتستخدم في الـ Server Components والـ Client Components الاتنين.

const PATHS = {
  home: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  users: "M9 4.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7zM2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.2 2.2 3.5 5",
  clipboard: "M9 3.5h6v3H9zM7 5H5.5A1.5 1.5 0 0 0 4 6.5v13A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 18.5 5H17M8.5 13l2.5 2.5 4.5-5",
  cross: "M12 3v18M6.5 8.5h11",
  book: "M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2zM4 20a2 2 0 0 0 2 1h13v-3",
  books: "M4 4h4v16H4zM10 4h4v16h-4zM16.5 4.8l3.8-1 3.2 15.4-3.8 1z",
  trophy: "M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 21h7M10 17h4v4",
  chat: "M4 5h16v11H9l-5 4z",
  bell: "M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0",
  idcard: "M3 6h18v12H3zM8.5 9.5a2 2 0 1 1 0 4a2 2 0 1 1 0-4zM13 10h5M13 14h4",
  user: "M12 4a4 4 0 1 1 0 8a4 4 0 1 1 0-8zM4 21c1.5-4 4.5-6 8-6s6.5 2 8 6",
  child: "M12 5a3 3 0 1 1 0 6a3 3 0 1 1 0-6zM6 21c.8-3.5 3.2-5.5 6-5.5s5.2 2 6 5.5",
  folder: "M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z",
  church: "M12 2v4M10 4h4M6 21V11l6-4 6 4v10M3 21h18M10 21v-4a2 2 0 0 1 4 0v4",
  calendar: "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4",
  check: "M5 12l5 5 9-10",
  checkCircle: "M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18zM8 12.5l3 3 5-6",
  clock: "M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18zM12 7v5l3 2",
  alert: "M12 3l9.5 17h-19zM12 10v4M12 17.5v.01",
  x: "M6 6l12 12M18 6L6 18",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 10.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7z",
  pause: "M8 5v14M16 5v14",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6",
  lock: "M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  eyeOff: "M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a16 16 0 0 1-2.7 3.2M6.6 6.6C4.3 8.1 3 12 3 12s4 6 9 6a8.8 8.8 0 0 0 4.4-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2",
  settings: "M12 9a3 3 0 1 1 0 6a3 3 0 1 1 0-6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z",
  timer: "M12 7a7 7 0 1 1 0 14a7 7 0 1 1 0-14zM12 10.5V14l2 1.5M10 3h4M12 3v4",
  paperclip: "M20 11.5l-8 8a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9.7 17a1.7 1.7 0 0 1-2.4-2.4l7.4-7.4",
  arrowLeft: "M19 12H5M11 6l-6 6 6 6",
  chevronLeft: "M15 6l-6 6 6 6",
  chevronDown: "M6 9l6 6 6-6",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  qr: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z"
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 16,
  strokeWidth = 2,
  className
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block flex-none ${className ?? ""}`}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
