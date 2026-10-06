export type AppRole =
  | "super_admin"
  | "general_secretary"
  | "stage_secretary"
  | "servant"
  | "member";

export type Stage = "prep1" | "prep2" | "prep3";

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "مدير عام",
  general_secretary: "أمين عام",
  stage_secretary: "أمين خدمة",
  servant: "خادم",
  member: "مستخدم عادي"
};

export const STAGE_LABELS: Record<Stage, string> = {
  prep1: "أولى إعدادي",
  prep2: "تانية إعدادي",
  prep3: "تالتة إعدادي"
};

export const STAGE_ORDER: Stage[] = ["prep1", "prep2", "prep3"];

/** المسار الذي يجب توجيه المستخدم إليه بعد تسجيل الدخول حسب نوعه. */
export function homePathForRole(role: AppRole): string {
  switch (role) {
    case "super_admin":
    case "general_secretary":
    case "stage_secretary":
      return "/admin";
    case "servant":
      return "/servant";
    case "member":
      return "/child";
  }
}

export function isManagementRole(role: AppRole): boolean {
  return role === "super_admin" || role === "general_secretary" || role === "stage_secretary";
}

/** كل الأدوار الخادمة (غير الأولاد) — تُستخدم لبوابة قسم /servant بدل تكرار
 * الفحص في middleware، فيُعاد استخدام نفس بيانات البروفايل التي يجلبها layout أصلًا. */
export function isStaffRole(role: AppRole): boolean {
  return role !== "member";
}

export function canManageUsers(role: AppRole): boolean {
  return role === "super_admin";
}

/** كل الأدوار الخادمة (غير الأولاد) تستطيع إدارة محتوى الصلاة والكتاب المقدس */
export function canManageContent(role: AppRole): boolean {
  return role !== "member";
}

/** هل يستطيع هذا الدور رؤية مرحلة معينة (بخلاف رؤية بياناته الشخصية فقط) */
export function canViewAllStages(role: AppRole): boolean {
  return role === "super_admin" || role === "general_secretary";
}
