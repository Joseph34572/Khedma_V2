import type { Metadata, Viewport } from "next";
import { PwaSetup } from "@/components/pwa/InstallApp";
import { Tajawal } from "next/font/google";
import "./globals.css";

const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-tajawal"
});

// كل الصفحات بتترندر لكل طلب (مش static) عشان سكريبتات Next.js تاخد الـ nonce
// بتاع CSP الخاص بالطلب ده (راجع lib/csp.ts). أغلب الصفحات كانت ديناميكية أصلًا.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "خدمة إعدادي",
  description: "تطبيق متابعة خدمة مرحلة إعدادي",
  manifest: "/manifest.json",
  applicationName: "خدمة إعدادي",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" }
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }]
  },
  // على الآيفون: لما يتضاف للشاشة الرئيسية يفتح كتطبيق بملء الشاشة من غير شريط Safari.
  appleWebApp: {
    capable: true,
    title: "خدمة إعدادي",
    statusBarStyle: "default"
  },
  formatDetection: { telephone: false }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#7A1F2B"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={tajawal.variable}>
      <body className="font-sans antialiased">
        <PwaSetup />
        {children}
      </body>
    </html>
  );
}
