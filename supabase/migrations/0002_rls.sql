-- ============================================================================
-- سياسات حماية الصفوف (RLS) — تُطبَّق الصلاحيات هنا على مستوى قاعدة البيانات
-- ولا يُعتمد على الواجهة أبدًا لإخفاء البيانات.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- دوال مساعدة (Security Definer) تُقرأ من profiles دون الدخول في حلقة RLS
-- ---------------------------------------------------------------------------
create or replace function auth_profile_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from profiles where id = auth.uid();
$$;

create or replace function auth_role() returns app_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function auth_stage() returns app_stage
language sql stable security definer set search_path = public as $$
  select stage_id from profiles where id = auth.uid();
$$;

create or replace function auth_status() returns account_status
language sql stable security definer set search_path = public as $$
  select status from profiles where id = auth.uid();
$$;

-- المستخدم نشط وله دور إداري يرى كل المراحل
create or replace function is_global_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select auth_status() = 'active' and auth_role() in ('super_admin', 'general_secretary');
$$;

create or replace function is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select auth_status() = 'active' and auth_role() = 'super_admin';
$$;

-- هل يرى المستخدم الحالي هذه المرحلة تحديدًا (خادم/أمين خدمة داخل مرحلته، أو إداري عام)
create or replace function can_view_stage(target_stage app_stage) returns boolean
language sql stable security definer set search_path = public as $$
  select
    auth_status() = 'active' and (
      is_global_admin()
      or (auth_role() in ('stage_secretary', 'servant') and auth_stage() = target_stage)
    );
$$;

-- هل يرى المستخدم الحالي بيانات هذا الشخص (نفسه، أو تابع لمرحلته وهو خادم/أمين خدمة، أو إداري عام)
create or replace function can_view_user(target_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select
    target_user = auth.uid()
    or (
      auth_status() = 'active' and (
        is_global_admin()
        or (
          auth_role() in ('stage_secretary', 'servant')
          and exists (
            select 1 from profiles p
            where p.id = target_user and p.stage_id = auth_stage()
          )
        )
      )
    );
$$;

-- ---------------------------------------------------------------------------
-- تفعيل RLS على كل الجداول
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table servant_assignments enable row level security;
alter table stages enable row level security;
alter table prayer_contents enable row level security;
alter table prayer_sessions enable row level security;
alter table prayer_activity_events enable row level security;
alter table bible_books enable row level security;
alter table bible_chapters enable row level security;
alter table bible_verses enable row level security;
alter table bible_reading_plans enable row level security;
alter table bible_reading_plan_items enable row level security;
alter table bible_reading_sessions enable row level security;
alter table bible_reading_activity_events enable row level security;
alter table bible_bookmarks enable row level security;
alter table masses enable row level security;
alter table mass_attendance enable row level security;
alter table confessions enable row level security;
alter table sunday_school_sessions enable row level security;
alter table sunday_school_attendance enable row level security;
alter table symposium_questions enable row level security;
alter table symposium_question_notes enable row level security;
alter table notifications enable row level security;
alter table notification_recipients enable row level security;
alter table user_devices enable row level security;
alter table quizzes enable row level security;
alter table quiz_questions enable row level security;
alter table quiz_question_choices enable row level security;
alter table quiz_attempts enable row level security;
alter table quiz_answers enable row level security;
alter table audit_log enable row level security;
alter table app_settings enable row level security;

-- ---------------------------------------------------------------------------
-- stages / bible content: قراءة عامة لكل مستخدم مسجّل، لا تعديل إلا للمدير العام
-- ---------------------------------------------------------------------------
create policy stages_select on stages for select using (auth.uid() is not null);
create policy bible_books_select on bible_books for select using (auth.uid() is not null);
create policy bible_chapters_select on bible_chapters for select using (auth.uid() is not null);
create policy bible_verses_select on bible_verses for select using (auth.uid() is not null);
create policy prayer_contents_select on prayer_contents for select using (auth.uid() is not null and is_active);
create policy prayer_contents_admin_all on prayer_contents for all using (is_super_admin()) with check (is_super_admin());
create policy bible_content_admin_write on bible_books for insert with check (is_super_admin());
create policy bible_chapters_admin_write on bible_chapters for insert with check (is_super_admin());
create policy bible_verses_admin_write on bible_verses for insert with check (is_super_admin());

-- ---------------------------------------------------------------------------
-- profiles: القاعدة الأساسية لكل الصلاحيات في التطبيق
-- ---------------------------------------------------------------------------
create policy profiles_select on profiles for select
  using (can_view_user(id));

create policy profiles_update_self on profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    -- المستخدم العادي لا يستطيع تغيير دوره أو مرحلته أو حالته أو رقم هاتفه بنفسه
    and role = (select role from profiles where id = auth.uid())
    and stage_id is not distinct from (select stage_id from profiles where id = auth.uid())
    and status = (select status from profiles where id = auth.uid())
    and phone_normalized = (select phone_normalized from profiles where id = auth.uid())
  );

create policy profiles_admin_write on profiles for insert
  with check (is_super_admin());

create policy profiles_admin_update on profiles for update
  using (is_super_admin())
  with check (is_super_admin());

-- لا يوجد حذف فعلي للمستخدمين؛ التعطيل فقط (يمنعه عدم وجود سياسة DELETE)

create policy servant_assignments_select on servant_assignments for select
  using (
    servant_id = auth.uid()
    or is_global_admin()
    or (auth_role() = 'stage_secretary' and stage_id = auth_stage())
  );
create policy servant_assignments_admin_write on servant_assignments for all
  using (is_super_admin()) with check (is_super_admin());

-- ---------------------------------------------------------------------------
-- الصلاة: كل شخص يدير جلساته الخاصة فقط، والإداريون يرون حسب نطاقهم
-- ---------------------------------------------------------------------------
create policy prayer_sessions_owner on prayer_sessions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy prayer_sessions_view_scope on prayer_sessions for select
  using (can_view_user(user_id));

create policy prayer_events_owner on prayer_activity_events for all
  using (exists (select 1 from prayer_sessions s where s.id = session_id and s.user_id = auth.uid()))
  with check (exists (select 1 from prayer_sessions s where s.id = session_id and s.user_id = auth.uid()));

create policy prayer_events_view_scope on prayer_activity_events for select
  using (exists (select 1 from prayer_sessions s where s.id = session_id and can_view_user(s.user_id)));

-- ---------------------------------------------------------------------------
-- قراءة الكتاب المقدس
-- ---------------------------------------------------------------------------
create policy reading_sessions_owner on bible_reading_sessions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy reading_sessions_view_scope on bible_reading_sessions for select
  using (can_view_user(user_id));

create policy reading_events_owner on bible_reading_activity_events for all
  using (exists (select 1 from bible_reading_sessions s where s.id = session_id and s.user_id = auth.uid()))
  with check (exists (select 1 from bible_reading_sessions s where s.id = session_id and s.user_id = auth.uid()));

create policy reading_events_view_scope on bible_reading_activity_events for select
  using (exists (select 1 from bible_reading_sessions s where s.id = session_id and can_view_user(s.user_id)));

create policy bookmarks_owner on bible_bookmarks for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy reading_plans_select on bible_reading_plans for select
  using (stage_id is null or can_view_stage(stage_id));
create policy reading_plans_admin_write on bible_reading_plans for insert with check (is_global_admin());
create policy reading_plans_admin_update on bible_reading_plans for update using (is_global_admin()) with check (is_global_admin());
create policy reading_plan_items_select on bible_reading_plan_items for select
  using (exists (
    select 1 from bible_reading_plans p
    where p.id = plan_id and (p.stage_id is null or can_view_stage(p.stage_id))
  ));
create policy reading_plan_items_admin_write on bible_reading_plan_items for insert with check (is_global_admin());

-- ---------------------------------------------------------------------------
-- القداسات
-- ---------------------------------------------------------------------------
create policy masses_select on masses for select using (auth.uid() is not null);
create policy masses_admin_write on masses for insert with check (is_global_admin());

create policy mass_attendance_owner_insert on mass_attendance for insert
  with check (user_id = auth.uid() and method = 'self_report');

create policy mass_attendance_view_scope on mass_attendance for select
  using (can_view_user(user_id));

create policy mass_attendance_staff_insert on mass_attendance for insert
  with check (
    method in ('qr_scan', 'manual_by_servant')
    and recorded_by = auth.uid()
    and can_view_user(user_id)
    and auth_role() <> 'member'
  );

-- ---------------------------------------------------------------------------
-- الاعتراف — وصول شديد التقييد: صاحب البيانات فقط، والمدير العام والأمين العام
-- ---------------------------------------------------------------------------
create policy confessions_owner_insert on confessions for insert
  with check (user_id = auth.uid());

create policy confessions_owner_select on confessions for select
  using (user_id = auth.uid() or is_global_admin());

-- ---------------------------------------------------------------------------
-- مدارس الأحد
-- ---------------------------------------------------------------------------
create policy sschool_sessions_select on sunday_school_sessions for select
  using (can_view_stage(stage_id));
create policy sschool_sessions_staff_write on sunday_school_sessions for insert
  with check (can_view_stage(stage_id) and auth_role() <> 'member');

create policy sschool_attendance_view_scope on sunday_school_attendance for select
  using (can_view_user(user_id));
create policy sschool_attendance_staff_insert on sunday_school_attendance for insert
  with check (recorded_by = auth.uid() and can_view_user(user_id) and auth_role() <> 'member');

-- ---------------------------------------------------------------------------
-- صندوق الندوة
-- ---------------------------------------------------------------------------
create policy symposium_owner_insert on symposium_questions for insert
  with check (user_id = auth.uid());

create policy symposium_owner_select on symposium_questions for select
  using (user_id = auth.uid());

create policy symposium_staff_select on symposium_questions for select
  using (can_view_stage(stage_id) and auth_role() <> 'member');

create policy symposium_staff_update on symposium_questions for update
  using (can_view_stage(stage_id) and auth_role() <> 'member')
  with check (can_view_stage(stage_id) and auth_role() <> 'member');

create policy symposium_notes_staff on symposium_question_notes for all
  using (
    exists (select 1 from symposium_questions q where q.id = question_id and can_view_stage(q.stage_id))
    and auth_role() <> 'member'
  )
  with check (author_id = auth.uid());

-- ---------------------------------------------------------------------------
-- الإشعارات
-- ---------------------------------------------------------------------------
create policy notifications_admin_write on notifications for all
  using (is_global_admin() or auth_role() = 'stage_secretary')
  with check (is_global_admin() or auth_role() = 'stage_secretary');

create policy notification_recipients_owner_select on notification_recipients for select
  using (user_id = auth.uid());

create policy notification_recipients_owner_update on notification_recipients for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy notification_recipients_admin_insert on notification_recipients for insert
  with check (is_global_admin() or auth_role() = 'stage_secretary');

create policy user_devices_owner on user_devices for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- المسابقات
-- ---------------------------------------------------------------------------
create policy quizzes_select on quizzes for select
  using (stage_id is null or can_view_stage(stage_id));
create policy quizzes_admin_write on quizzes for all
  using (is_global_admin()) with check (is_global_admin());

create policy quiz_questions_select on quiz_questions for select
  using (exists (select 1 from quizzes q where q.id = quiz_id and (q.stage_id is null or can_view_stage(q.stage_id))));
create policy quiz_questions_admin_write on quiz_questions for all
  using (is_global_admin()) with check (is_global_admin());

create policy quiz_choices_select on quiz_question_choices for select
  using (exists (
    select 1 from quiz_questions qq join quizzes q on q.id = qq.quiz_id
    where qq.id = question_id and (q.stage_id is null or can_view_stage(q.stage_id))
  ));
create policy quiz_choices_admin_write on quiz_question_choices for all
  using (is_global_admin()) with check (is_global_admin());

create policy quiz_attempts_owner on quiz_attempts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy quiz_attempts_view_scope on quiz_attempts for select
  using (can_view_user(user_id));

create policy quiz_answers_owner on quiz_answers for all
  using (exists (select 1 from quiz_attempts a where a.id = attempt_id and a.user_id = auth.uid()))
  with check (exists (select 1 from quiz_attempts a where a.id = attempt_id and a.user_id = auth.uid()));
create policy quiz_answers_view_scope on quiz_answers for select
  using (exists (select 1 from quiz_attempts a where a.id = attempt_id and can_view_user(a.user_id)));

-- ---------------------------------------------------------------------------
-- سجل العمليات: كتابة من الخادم فقط (service role) — قراءة للإداريين فقط
-- ---------------------------------------------------------------------------
create policy audit_log_admin_select on audit_log for select
  using (is_global_admin());
-- لا توجد سياسة INSERT هنا: الإدراج يتم فقط عبر مفتاح الخدمة (service role) من الخادم

-- ---------------------------------------------------------------------------
-- إعدادات التطبيق
-- ---------------------------------------------------------------------------
create policy app_settings_select on app_settings for select using (auth.uid() is not null);
create policy app_settings_admin_write on app_settings for all
  using (is_super_admin()) with check (is_super_admin());
