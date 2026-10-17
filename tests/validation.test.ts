import { describe, expect, it } from "vitest";
import { safeUrlOrNull, passwordSchema } from "@/lib/validation";

describe("safeUrlOrNull", () => {
  it("يقبل قيمة فارغة كـ null", () => {
    expect(safeUrlOrNull(null)).toEqual({ ok: true, value: null });
    expect(safeUrlOrNull("")).toEqual({ ok: true, value: null });
    expect(safeUrlOrNull("   ")).toEqual({ ok: true, value: null });
  });

  it("يقبل مسار داخلي نسبي يبدأ بـ /", () => {
    expect(safeUrlOrNull("/admin/notifications")).toEqual({ ok: true, value: "/admin/notifications" });
  });

  it("يرفض مسار protocol-relative (//)", () => {
    const result = safeUrlOrNull("//evil.example.com/phish");
    expect(result.ok).toBe(false);
  });

  it("يقبل رابط https فقط", () => {
    const result = safeUrlOrNull("https://example.com/path");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("https://example.com/path");
  });

  it("يرفض javascript:", () => {
    const result = safeUrlOrNull("javascript:alert(1)");
    expect(result.ok).toBe(false);
  });

  it("يرفض data:", () => {
    const result = safeUrlOrNull("data:text/html,<script>alert(1)</script>");
    expect(result.ok).toBe(false);
  });

  it("يرفض http غير الآمن", () => {
    const result = safeUrlOrNull("http://example.com");
    expect(result.ok).toBe(false);
  });
});

describe("passwordSchema", () => {
  it("يرفض أقل من 6 أحرف", () => {
    expect(passwordSchema.safeParse("12345").success).toBe(false);
  });

  it("يقبل 6 أحرف بالضبط (السياسة الحالية للمشروع)", () => {
    expect(passwordSchema.safeParse("123456").success).toBe(true);
  });

  it("يرفض أكثر من 128 حرف", () => {
    expect(passwordSchema.safeParse("a".repeat(129)).success).toBe(false);
  });
});
