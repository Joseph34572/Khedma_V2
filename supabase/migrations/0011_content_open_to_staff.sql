-- توسيع إدارة محتوى الصلاة والكتاب المقدس (إضافة/تعديل/حذف) لتشمل كل
-- الأدوار الخادمة (الخادم، أمين الخدمة) وليس المدير/الأمين العام فقط،
-- تنفيذًا لطلب المستخدم. القراءة تبقى كما هي (مفتوحة لكل مستخدم مسجّل،
-- مع تفعيل is_active لمحتوى الصلاة) ولا تتأثر بهذا التعديل.

drop policy if exists prayer_contents_admin_all on prayer_contents;
create policy prayer_contents_staff_write on prayer_contents for all
  using (auth_role() <> 'member') with check (auth_role() <> 'member');

drop policy if exists bible_content_admin_write on bible_books;
create policy bible_books_staff_write on bible_books for all
  using (auth_role() <> 'member') with check (auth_role() <> 'member');

drop policy if exists bible_chapters_admin_write on bible_chapters;
create policy bible_chapters_staff_write on bible_chapters for all
  using (auth_role() <> 'member') with check (auth_role() <> 'member');

drop policy if exists bible_verses_admin_write on bible_verses;
create policy bible_verses_staff_write on bible_verses for all
  using (auth_role() <> 'member') with check (auth_role() <> 'member');
