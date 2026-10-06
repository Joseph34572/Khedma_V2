import { describe, it, expect } from "vitest";
import { normalizePhone, phoneToAuthEmail, formatPhoneForDisplay } from "@/lib/phone";

describe("normalizePhone", () => {
  it("يوحّد رقمًا مصريًا محليًا يبدأ بصفر", () => {
    expect(normalizePhone("01012345678")).toBe("201012345678");
  });

  it("يوحّد رقمًا بصيغة دولية بعلامة +", () => {
    expect(normalizePhone("+201012345678")).toBe("201012345678");
  });

  it("يوحّد رقمًا بصيغة 00 الدولية", () => {
    expect(normalizePhone("00201012345678")).toBe("201012345678");
  });

  it("يوحّد رقمًا يحتوي على مسافات وشرطات", () => {
    expect(normalizePhone("010 1234 5678")).toBe("201012345678");
    expect(normalizePhone("010-1234-5678")).toBe("201012345678");
  });

  it("يرفض رقمًا قصيرًا جدًا", () => {
    expect(normalizePhone("12345")).toBeNull();
  });

  it("جميع الصيغ المختلفة لنفس الرقم تنتج نفس القيمة الموحدة (منع تكرار الحساب)", () => {
    const variants = ["01012345678", "+201012345678", "00201012345678", "010-1234-5678"];
    const normalized = variants.map(normalizePhone);
    expect(new Set(normalized).size).toBe(1);
  });
});

describe("phoneToAuthEmail", () => {
  it("ينشئ بريدًا داخليًا لا يظهر للمستخدم أبدًا", () => {
    expect(phoneToAuthEmail("201012345678")).toBe("201012345678@phone.khedma.internal");
  });
});

describe("formatPhoneForDisplay", () => {
  it("يعرض الرقم المصري بصيغته المحلية المألوفة", () => {
    expect(formatPhoneForDisplay("201012345678")).toBe("01012345678");
  });
});
