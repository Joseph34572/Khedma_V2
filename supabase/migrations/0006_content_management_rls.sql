-- ============================================================================
-- توسيع صلاحية إدارة المحتوى (نصوص الصلاة والكتاب المقدس) لتشمل الأمين العام
-- أيضًا وليس المدير العام فقط، تنفيذًا لنص القسم 5: "الأمين العام: إدارة
-- المحتوى المسموح له". باقي عمليات الإدارة (المستخدمون، الصلاحيات) تبقى
-- مقصورة على المدير العام فقط كما في 0002_rls.sql.
-- ============================================================================
drop policy if exists prayer_contents_admin_all on prayer_contents;
create policy prayer_contents_admin_all on prayer_contents for all
  using (is_global_admin()) with check (is_global_admin());

drop policy if exists bible_content_admin_write on bible_books;
create policy bible_content_admin_write on bible_books for all
  using (is_global_admin()) with check (is_global_admin());

drop policy if exists bible_chapters_admin_write on bible_chapters;
create policy bible_chapters_admin_write on bible_chapters for all
  using (is_global_admin()) with check (is_global_admin());

drop policy if exists bible_verses_admin_write on bible_verses;
create policy bible_verses_admin_write on bible_verses for all
  using (is_global_admin()) with check (is_global_admin());
