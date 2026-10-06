-- السماح بحذف كشوف الحضور (قداسات وجلسات مدارس الأحد) بعد إنشائها بالخطأ.
-- الحذف يحترم نفس نطاق الصلاحيات المفروض وقت الإنشاء: القداسات للمدير/الأمين
-- العام فقط (لأنها مشتركة بين كل المراحل)، وجلسات مدارس الأحد لأي خادم/أمين
-- يملك صلاحية على مرحلة الجلسة.

create policy masses_admin_delete on masses for delete
  using (is_global_admin());

create policy sschool_sessions_delete on sunday_school_sessions for delete
  using (can_view_stage(stage_id) and auth_role() <> 'member');
