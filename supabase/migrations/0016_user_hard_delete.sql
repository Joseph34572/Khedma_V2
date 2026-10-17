-- ============================================================================
-- تمكين حذف الحسابات نهائيًا (وليس بس تعطيلها) من لوحة تحكم المدير العام.
--
-- المشكلة: عمود "id" في profiles مرتبط بـ auth.users بـ "on delete cascade"،
-- فحذف المستخدم من auth.users (عبر supabase.auth.admin.deleteUser) بيحذف صف
-- profiles بتاعه تلقائيًا. لكن أعمدة تانية كتير بترجع لـ profiles(id) كـ "من
-- سجّل/أنشأ/كلّف العملية دي" (مش "بيانات هو نفسه")، وده بيعمل مشكلتين:
--
-- 1) أعمدة زي audit_log.actor_id و notifications.created_by و
--    mass_attendance.recorded_by وغيرها معرَّفة بدون "on delete" صريح، يعني
--    القيمة الافتراضية في Postgres هي NO ACTION — فحذف أي مستخدم شارك كـ
--    "منفّذ" لأي عملية زي دي (كل خادم/أمين خدمة تقريبًا) هيفشل برسالة خطأ من
--    قاعدة البيانات (foreign key violation) بدل ما يتم الحذف فعليًا.
-- 2) حتى لو الحذف نجح لمستخدم مالوش أي سجل من دول، سجل العمليات والمتابعة
--    بتاعة الآخرين (زي "مين سجّل حضور القداس ده؟") كان ممكن يضيع لو الربط كان
--    "on delete cascade" بالغلط بدل ما يفضل السجل موجود.
--
-- الحل: نغيّر كل الأعمدة دي (اللي معناها "مين نفّذ/أنشأ العملية" مش "بيانات
-- صاحبها") لتبقى "on delete set null" — يعني لو اتحذف المستخدم، السجلات التانية
-- (حضور، إشعارات، مسابقات، سجل العمليات...) تفضل موجودة زي ما هي، بس عمود
-- "مين عمل ده" يبقى فاضي (NULL) بدل ما يمنع الحذف أو يمسح السجل نفسه. البيانات
-- الشخصية للمستخدم نفسه (صلاته، قراءاته، حضوره هو، محاولاته في المسابقات) كانت
-- أصلًا "on delete cascade" من قبل، وده يفضل زي ما هو — دي بيانات بتاعته هو،
-- من المنطقي تتمسح لما حسابه يتمسح.
do $$
declare
  cname text;
  spec record;
begin
  for spec in
    select * from (values
      ('profiles', 'created_by'),
      ('bible_reading_plans', 'created_by'),
      ('mass_attendance', 'recorded_by'),
      ('sunday_school_sessions', 'created_by'),
      ('sunday_school_attendance', 'recorded_by'),
      ('symposium_questions', 'assigned_to'),
      ('notifications', 'created_by'),
      ('quizzes', 'created_by'),
      ('quiz_attempts', 'graded_by'),
      ('audit_log', 'actor_id'),
      ('app_settings', 'updated_by')
    ) as t(table_name, column_name)
  loop
    select tc.constraint_name into cname
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
    where tc.table_schema = 'public'
      and tc.table_name = spec.table_name
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = spec.column_name;

    if cname is not null then
      execute format('alter table %I drop constraint %I', spec.table_name, cname);
    end if;

    execute format(
      'alter table %I add constraint %I foreign key (%I) references profiles(id) on delete set null',
      spec.table_name, spec.table_name || '_' || spec.column_name || '_fkey', spec.column_name
    );
  end loop;
end $$;

-- عمود symposium_question_notes.author_id كان "not null"، فلازم نسمح بـ NULL
-- فيه الأول قبل ما نقدر نحط "on delete set null" عليه (نفس المنطق فوق: نفضل
-- نص الملاحظة موجود، بس نخلي "مين كتبها" يبقى فاضي لو كاتبها اتحذف).
alter table symposium_question_notes alter column author_id drop not null;

do $$
declare
  cname text;
begin
  select tc.constraint_name into cname
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'symposium_question_notes'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'author_id';

  if cname is not null then
    execute format('alter table symposium_question_notes drop constraint %I', cname);
  end if;

  alter table symposium_question_notes
    add constraint symposium_question_notes_author_id_fkey
    foreign key (author_id) references profiles(id) on delete set null;
end $$;

-- للتحقق بعد تشغيل هذا الملف: الاستعلام ده المفروض يرجّع صفر صفوف (يعني مفيش
-- أي عمود تاني بيرجع لـ profiles(id) بدون "on delete" صريح، وبالتالي أي عمود
-- زيه هيمنع حذف أي مستخدم مرتبط بيه):
--   select conrelid::regclass, conname, confdeltype
--   from pg_constraint
--   where confrelid = 'public.profiles'::regclass and confdeltype = 'a';  -- 'a' = NO ACTION
