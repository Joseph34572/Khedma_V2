import { describe, expect, it } from "vitest";
import { todayInCairo, canSelfReportMass } from "@/lib/today";

describe("todayInCairo", () => {
  it("uses the Cairo date, not the UTC date, late at night", () => {
    // 23:00 UTC يوم 10 يناير = 1 الصبح يوم 11 يناير بتوقيت القاهرة (UTC+2 في الشتا).
    expect(todayInCairo(new Date("2026-01-10T23:00:00Z"))).toBe("2026-01-11");
  });

  it("keeps the same day during the Cairo daytime", () => {
    expect(todayInCairo(new Date("2026-01-10T10:00:00Z"))).toBe("2026-01-10");
  });
});

describe("canSelfReportMass", () => {
  // 2026-10-18 الساعة 12 الظهر بتوقيت القاهرة
  const now = new Date("2026-10-18T09:00:00Z");
  it("يسمح بالنهارده وآخر 7 أيام", () => {
    expect(canSelfReportMass("2026-10-18", now)).toBe(true);
    expect(canSelfReportMass("2026-10-11", now)).toBe(true);
  });
  it("يرفض القداس اللي لسه مجاش أو الأقدم من أسبوع", () => {
    expect(canSelfReportMass("2026-10-19", now)).toBe(false);
    expect(canSelfReportMass("2026-10-10", now)).toBe(false);
  });
});
