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

  it("يقبل رابط https لموقع من القائمة المسموحة", () => {
    const result = safeUrlOrNull("https://www.youtube.com/watch?v=abc");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("https://www.youtube.com/watch?v=abc");
  });

  it("يرفض رابط https لموقع مش في القائمة (تصيّد)", () => {
    expect(safeUrlOrNull("https://example.com/path").ok).toBe(false);
    expect(safeUrlOrNull("https://youtube.com.evil.example/login").ok).toBe(false);
    expect(safeUrlOrNull("https://user:pw@youtube.com/").ok).toBe(false);
  });

  it("يرفض مسار يبدأ بـ /\\ (بعض المتصفحات بتعتبره دومين)", () => {
    expect(safeUrlOrNull("/\\evil.example.com").ok).toBe(false);
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
  it("يرفض أقل من 8 أحرف", () => {
    expect(passwordSchema.safeParse("Ab3$xyz").success).toBe(false);
  });

  it("يقبل 8 أحرف مش سهلة", () => {
    expect(passwordSchema.safeParse("mark2024").success).toBe(true);
    expect(passwordSchema.safeParse("01012345678").success).toBe(true);
  });

  it("يرفض كلمات المرور المشهورة والمتسلسلة والمكررة", () => {
    for (const pw of ["12345678", "Password", "87654321", "23456789", "aaaaaaaa", "00000000"]) {
      expect(passwordSchema.safeParse(pw).success).toBe(false);
    }
  });

  it("يرفض أكثر من 128 حرف", () => {
    expect(passwordSchema.safeParse("a".repeat(129)).success).toBe(false);
  });
});
