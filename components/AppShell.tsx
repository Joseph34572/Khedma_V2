"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/actions";

export type NavItem = { href: string; label: string; icon: string };

const ROOTS = ["/admin", "/servant", "/child"];

export function AppShell({
  navItems,
  userName,
  roleLabel,
  children
}: {
  navItems: NavItem[];
  activeHref?: string;
  userName: string;
  roleLabel: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    ROOTS.includes(href) ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden lg:flex lg:w-64 lg:flex-col border-l border-line bg-white p-4">
        <div className="flex items-center gap-2 px-2 py-3 mb-4">
          <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-gold-light font-bold">✝</div>
          <p className="font-extrabold text-ink leading-none">خدمة إعدادي</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive(item.href) ? "bg-primary text-white" : "text-ink-soft hover:bg-parchment"
              }`}
            >
              <span aria-hidden>{item.icon}</span>
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
        <header className="lg:hidden flex items-center justify-between border-b border-line bg-white px-4 py-3">
          <p className="font-extrabold text-ink">خدمة إعدادي</p>
          <form action={signOutAction}>
            <button type="submit" className="text-sm text-bad font-medium">خروج</button>
          </form>
        </header>

        <main className="flex-1 p-4 lg:p-8 pb-24 lg:pb-8">{children}</main>

        <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-line flex overflow-x-auto py-2 z-10">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-none min-w-[76px] flex flex-col items-center gap-0.5 px-2 py-1 text-[11px] font-medium ${
                isActive(item.href) ? "text-primary" : "text-ink-soft"
              }`}
            >
              <span className="text-lg" aria-hidden>{item.icon}</span>
              <span className="whitespace-nowrap">{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
