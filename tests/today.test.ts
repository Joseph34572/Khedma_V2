import { describe, expect, it } from "vitest";
import { todayInCairo } from "@/lib/today";

describe("todayInCairo", () => {
  it("uses the Cairo date, not the UTC date, late at night", () => {
    // 23:00 UTC يوم 10 يناير = 1 الصبح يوم 11 يناير بتوقيت القاهرة (UTC+2 في الشتا).
    expect(todayInCairo(new Date("2026-01-10T23:00:00Z"))).toBe("2026-01-11");
  });

  it("keeps the same day during the Cairo daytime", () => {
    expect(todayInCairo(new Date("2026-01-10T10:00:00Z"))).toBe("2026-01-10");
  });
});
