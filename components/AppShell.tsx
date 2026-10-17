"use client";

import { InstallBanner } from "@/components/pwa/InstallApp";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/actions";
import { Icon, type IconName } from "@/components/ui/Icon";

export type NavItem = { href: string; label: string; icon: IconName };

const ROOTS = ["/admin", "/servant", "/child"];

// عرض كل زرار في شريط التنقل السفلي (بالبكسل) — الـ "حبّاية" اللي بتتزحلق تحت
// الزرار النشط بتتحسب منه، فلازم يفضل ثابت ومطابق لـ w-[76px] تحت.
const TAB_WIDTH = 76;
const PILL_WIDTH = 62;

export function AppShell({
  navItems,
  userName,
  roleLabel,
  profileHref,
  children
}: {
  navItems: NavItem[];
  activeHref?: string;
  userName: string;
  roleLabel: string;
  /** لو موجود، اسم المستخدم في الهيدر بيبقى رابط لصفحة ملفه الشخصي. */
  profileHref?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    ROOTS.includes(href) ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  const activeIndex = navItems.findIndex((item) => isActive(item.href));
  const firstName = userName.trim().split(/\s+/)[0] ?? "";

  // لو عدد الأقسام أكبر من عرض الشاشة، الشريط السفلي بيتسكرول أفقي؛ نخلي الزرار
  // النشط يبان في النص بعد كل تنقّل.
  const bottomNavRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomNavRef.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [pathname]);

  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden lg:flex lg:w-64 lg:flex-col border-l border-line bg-white p-4">
        <div className="flex items-center gap-3 px-2 py-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-gold flex items-center justify-center text-primary-dark">
            <Icon name="cross" size={20} />
          </div>
          <p className="font-extrabold text-ink leading-none">خدمة إعدادي</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              // كل صفحات التطبيق ديناميكية وبيانات كل مستخدم خاصة به، فالـ prefetch
              // التلقائي لـ Next.js (بيحصل لحظة ظهور أي رابط في الشاشة) كان بيعمل طلب
              // حقيقي لـ Supabase لكل رابط في القائمة الجانبية على كل صفحة — ده كان
              // بيزنق اتصالات المتصفح والسيرفر ويبطّئ الطلب الحقيقي اللي المستخدم مستنيه.
              prefetch={false}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`nav-tab flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                isActive(item.href) ? "bg-primary text-white" : "text-ink-soft hover:bg-parchment"
              }`}
            >
              <Icon name={item.icon} size={20} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-line pt-3 mt-3">
          <p className="text-sm font-bold text-ink">{userName}</p>
          <p className="text-xs text-ink-soft mb-3">{roleLabel}</p>
          <form action={signOutAction}>
            <button type="submit" className="text-sm text-bad font-medium hover:underline">تسجيل الخروج</button>
          </form>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        <header className="relative overflow-hidden bg-primary text-parchment px-5 pt-5 pb-8 rounded-b-[32px] lg:mx-8 lg:mt-4 lg:rounded-[28px] lg:pb-6">
          <span aria-hidden className="anim-float absolute top-5 left-8 h-2.5 w-2.5 rounded-full bg-gold opacity-70" />
          <span aria-hidden className="anim-float absolute top-16 left-20 h-1.5 w-1.5 rounded-full bg-gold opacity-50 [animation-delay:0.8s]" />
          <span aria-hidden className="anim-float absolute top-24 left-5 h-3.5 w-3.5 rounded-full bg-gold opacity-35 [animation-delay:1.6s]" />
          <div className="relative flex items-center gap-3">
            <div className="h-12 w-12 flex-none rounded-2xl bg-gold flex items-center justify-center text-primary-dark lg:hidden">
              <Icon name="cross" size={22} />
            </div>
            {profileHref ? (
              // الاسم نفسه هو المدخل لملف المستخدم (بدل "حسابي" في الشريط السفلي).
              <Link
                href={profileHref}
                prefetch={false}
                aria-label={`ملفي الشخصي: ${userName}`}
                className="min-w-0 rounded-2xl -mx-2 px-2 py-1 transition-colors hover:bg-parchment/10"
              >
                <p className="text-[13px] font-medium text-gold-light">{roleLabel}</p>
                <p className="text-[22px] font-extrabold leading-tight truncate flex items-center gap-1.5">
                  أهلًا {firstName}
                  <Icon name="chevronLeft" size={18} strokeWidth={2.5} className="opacity-70" />
                </p>
              </Link>
            ) : (
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-gold-light">{roleLabel}</p>
                <p className="text-[22px] font-extrabold leading-tight truncate">أهلًا {firstName}</p>
              </div>
            )}
            <form action={signOutAction} className="ms-auto lg:hidden">
              <button
                type="submit"
                className="nav-tab flex h-11 items-center gap-1.5 rounded-full bg-parchment/15 px-4 text-sm font-bold text-parchment"
              >
                خروج
              </button>
            </form>
          </div>
        </header>

        <main className="flex-1 p-4 -mt-3 lg:mt-0 lg:p-8 pb-28 lg:pb-8">
          {/* المفتاح = المسار، فمع كل تنقّل المحتوى بيدخل بحركة "النطّة" من جديد. */}
          <InstallBanner />
          <div key={pathname} className="page-enter">
            {children}
          </div>
        </main>

        <nav
          aria-label="التنقل الرئيسي"
          className="lg:hidden fixed bottom-0 inset-x-0 z-10 bg-white border-t-2 border-line overflow-x-auto pt-2 pb-[max(12px,env(safe-area-inset-bottom))]"
        >
          <div ref={bottomNavRef} className="relative flex min-w-max mx-auto">
            {activeIndex >= 0 && (
              <span
                aria-hidden
                className="nav-pill absolute top-0 h-[52px] rounded-[18px] bg-[#F4E6D3]"
                style={{ width: PILL_WIDTH, right: activeIndex * TAB_WIDTH + (TAB_WIDTH - PILL_WIDTH) / 2 }}
              />
            )}
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  aria-current={active ? "page" : undefined}
                  className={`nav-tab relative flex-none w-[76px] h-[52px] flex flex-col items-center justify-center gap-0.5 text-[11px] ${
                    active ? "text-primary font-extrabold" : "text-ink-soft font-medium"
                  }`}
                >
                  <Icon name={item.icon} size={22} />
                  <span className="whitespace-nowrap">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
