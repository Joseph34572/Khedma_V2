import { describe, it, expect } from "vitest";
import { homePathForRole, canManageUsers, canViewAllStages, isManagementRole, canManageContent } from "@/lib/roles";

describe("homePathForRole", () => {
  it("يوجّه المدير العام والأمناء إلى لوحة الإدارة", () => {
    expect(homePathForRole("super_admin")).toBe("/admin");
    expect(homePathForRole("general_secretary")).toBe("/admin");
    expect(homePathForRole("stage_secretary")).toBe("/admin");
  });

  it("يوجّه الخادم إلى لوحته الخاصة", () => {
    expect(homePathForRole("servant")).toBe("/servant");
  });

  it("يوجّه المستخدم العادي إلى لوحة الولد", () => {
    expect(homePathForRole("member")).toBe("/child");
  });
});

describe("canManageUsers", () => {
  it("المدير العام فقط يستطيع إدارة المستخدمين", () => {
    expect(canManageUsers("super_admin")).toBe(true);
    expect(canManageUsers("general_secretary")).toBe(false);
    expect(canManageUsers("stage_secretary")).toBe(false);
    expect(canManageUsers("servant")).toBe(false);
    expect(canManageUsers("member")).toBe(false);
  });
});

describe("canViewAllStages", () => {
  it("المدير العام والأمين العام فقط يريان كل المراحل", () => {
    expect(canViewAllStages("super_admin")).toBe(true);
    expect(canViewAllStages("general_secretary")).toBe(true);
    expect(canViewAllStages("stage_secretary")).toBe(false);
    expect(canViewAllStages("servant")).toBe(false);
    expect(canViewAllStages("member")).toBe(false);
  });
});

describe("isManagementRole", () => {
  it("يحدد الأدوار الإدارية بشكل صحيح", () => {
    expect(isManagementRole("stage_secretary")).toBe(true);
    expect(isManagementRole("servant")).toBe(false);
    expect(isManagementRole("member")).toBe(false);
  });
});

describe("canManageContent", () => {
  it("كل الأدوار الخادمة تستطيع إدارة محتوى الصلاة والكتاب المقدس عدا الأولاد", () => {
    expect(canManageContent("super_admin")).toBe(true);
    expect(canManageContent("general_secretary")).toBe(true);
    expect(canManageContent("stage_secretary")).toBe(true);
    expect(canManageContent("servant")).toBe(true);
    expect(canManageContent("member")).toBe(false);
  });
});
