-- ============================================================================
-- المخطط الأساسي لقاعدة بيانات تطبيق خدمة مرحلة إعدادي
-- ============================================================================
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1) الأنواع الأساسية (Enums)
-- ---------------------------------------------------------------------------
create type app_role as enum (
  'super_admin',       -- مدير عام
  'general_secretary', -- أمين عام
  'stage_secretary',   -- أمين خدمة
  'servant',           -- خادم
  'member'             -- مستخدم عادي (ولد)
);

create type app_stage as enum ('prep1', 'prep2', 'prep3');

create type account_status as enum ('active', 'disabled');

create type prayer_session_status as enum ('in_progress', 'completed', 'abandoned');
create type reading_session_status as enum ('in_progress', 'completed', 'abandoned');
create type activity_level as enum ('low', 'medium', 'high');            -- درجة النشاط
create type completion_level as enum ('not_started', 'partial', 'likely_complete'); -- درجة الإكمال

create type mass_attendance_method as enum ('self_report', 'qr_scan', 'manual_by_servant');
create type sunday_school_attendance_method as enum ('qr_scan', 'manual_by_servant');

create type question_status as enum ('new', 'reviewed', 'discussed', 'archived');

create type quiz_question_type as enum ('single_choice', 'multiple_choice', 'true_false', 'text');

create type notification_channel as enum ('in_app', 'push');
create type notification_target_type as enum ('all', 'all_servants', 'stage', 'role', 'specific_users');

-- ---------------------------------------------------------------------------
-- 2) المستخدمون والملفات الشخصية والمراحل
-- ---------------------------------------------------------------------------
-- ملاحظة: auth.users من Supabase Auth تحتوي على بيانات الدخول (بريد داخلي وهمي + كلمة مرور مشفّرة).
-- profiles تحتوي على البيانات الفعلية للمستخدم داخل النظام.

create table stages (
  id app_stage primary key,
  name_ar text not null,
  sort_order smallint not null unique
);

insert into stages (id, name_ar, sort_order) values
  ('prep1', 'أولى إعدادي', 1),
  ('prep2', 'تانية إعدادي', 2),
  ('prep3', 'تالتة إعدادي', 3);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone_normalized text not null unique,       -- الصيغة الموحدة لرقم الهاتف (اسم المستخدم الفعلي)
  role app_role not null default 'member',
  stage_id app_stage references stages(id),    -- إلزامي لأمين الخدمة والخادم والمستخدم العادي، فارغ للمدير/الأمين العام
  status account_status not null default 'active',
  qr_token text unique not null default encode(gen_random_bytes(18), 'hex'), -- رمز عشوائي آمن لا يكشف أي بيانات
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  updated_at timestamptz not null default now(),

  constraint stage_required_for_stage_bound_roles check (
    (role in ('stage_secretary', 'servant', 'member') and stage_id is not null)
    or (role in ('super_admin', 'general_secretary') and stage_id is null)
  )
);

create index idx_profiles_role on profiles(role);
create index idx_profiles_stage on profiles(stage_id);
create index idx_profiles_status on profiles(status);

-- يمنع النظام إنشاء أكثر من مدير عام واحد
create unique index one_super_admin_only on profiles ((role = 'super_admin')) where role = 'super_admin';

create table servant_assignments (
  -- يسمح بتكليف خادم/أمين خدمة بأكثر من مرحلة مستقبلًا دون تغيير هيكل المستخدم الأساسي
  id uuid primary key default gen_random_uuid(),
  servant_id uuid not null references profiles(id) on delete cascade,
  stage_id app_stage not null references stages(id),
  created_at timestamptz not null default now(),
  unique (servant_id, stage_id)
);

-- ---------------------------------------------------------------------------
-- 3) الصلاة
-- ---------------------------------------------------------------------------
create table prayer_contents (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,          -- matins, third_hour, sixth_hour, ninth_hour, vespers, compline, midnight
  title_ar text not null,
  body_ar text not null,              -- نص الصلاة الفعلي (يُدار من الإعدادات)
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table prayer_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  prayer_content_id uuid not null references prayer_contents(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  active_seconds integer not null default 0,     -- الوقت النشط الفعلي بعد استبعاد فترات عدم النشاط
  progress_percent smallint not null default 0 check (progress_percent between 0 and 100),
  sections_viewed jsonb not null default '[]',   -- قائمة معرفات الأجزاء التي تم فتحها
  activity_level activity_level,
  completion_level completion_level not null default 'not_started',
  status prayer_session_status not null default 'in_progress',
  created_at timestamptz not null default now()
);

create index idx_prayer_sessions_user on prayer_sessions(user_id, started_at desc);

-- أحداث نشاط مجمّعة (وليست لكل حركة تمرير)؛ تُكتب دفعة واحدة كل فترة قصيرة من التطبيق
create table prayer_activity_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references prayer_sessions(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  event_type text not null,           -- scroll_batch | section_change | idle_period | resume
  payload jsonb not null default '{}'
);

create index idx_prayer_events_session on prayer_activity_events(session_id, occurred_at);

-- ---------------------------------------------------------------------------
-- 4) الكتاب المقدس
-- ---------------------------------------------------------------------------
create table bible_books (
  id smallint primary key,
  name_ar text not null,
  testament text not null check (testament in ('old', 'new')),
  sort_order smallint not null unique
);

create table bible_chapters (
  id uuid primary key default gen_random_uuid(),
  book_id smallint not null references bible_books(id),
  chapter_number smallint not null,
  unique (book_id, chapter_number)
);

create table bible_verses (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references bible_chapters(id) on delete cascade,
  verse_number smallint not null,
  text_ar text not null,
  unique (chapter_id, verse_number)
);
create index idx_bible_verses_chapter on bible_verses(chapter_id, verse_number);
create index idx_bible_verses_search on bible_verses using gin (to_tsvector('simple', text_ar));

create table bible_reading_plans (
  id uuid primary key default gen_random_uuid(),
  title_ar text not null,
  stage_id app_stage references stages(id),   -- فارغ يعني متاحة لكل المراحل
  start_date date not null,
  end_date date not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table bible_reading_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references bible_reading_plans(id) on delete cascade,
  day_number smallint not null,
  book_id smallint not null references bible_books(id),
  chapter_number smallint not null,
  unique (plan_id, day_number)
);

create table bible_reading_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  chapter_id uuid not null references bible_chapters(id),
  plan_item_id uuid references bible_reading_plan_items(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  active_seconds integer not null default 0,
  progress_percent smallint not null default 0 check (progress_percent between 0 and 100),
  activity_level activity_level,
  completion_level completion_level not null default 'not_started',
  status reading_session_status not null default 'in_progress',
  created_at timestamptz not null default now()
);
create index idx_reading_sessions_user on bible_reading_sessions(user_id, started_at desc);

create table bible_reading_activity_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references bible_reading_sessions(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  event_type text not null,
  payload jsonb not null default '{}'
);

create table bible_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  verse_id uuid not null references bible_verses(id),
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, verse_id)
);

-- ---------------------------------------------------------------------------
-- 5) القداسات
-- ---------------------------------------------------------------------------
create table masses (
  id uuid primary key default gen_random_uuid(),
  title_ar text not null,       -- مثال: قداس الأحد
  mass_date date not null,
  created_at timestamptz not null default now()
);

create table mass_attendance (
  id uuid primary key default gen_random_uuid(),
  mass_id uuid not null references masses(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  method mass_attendance_method not null default 'self_report',
  recorded_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (mass_id, user_id)
);
create index idx_mass_attendance_user on mass_attendance(user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 6) الاعتراف (بيانات شديدة الحساسية)
-- ---------------------------------------------------------------------------
create table confessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  confessed_at date not null,
  created_at timestamptz not null default now()
);
create index idx_confessions_user on confessions(user_id, confessed_at desc);

-- ---------------------------------------------------------------------------
-- 7) مدارس الأحد
-- ---------------------------------------------------------------------------
create table sunday_school_sessions (
  id uuid primary key default gen_random_uuid(),
  stage_id app_stage not null references stages(id),
  session_date date not null,
  starts_at time,
  ends_at time,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table sunday_school_attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sunday_school_sessions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  method sunday_school_attendance_method not null default 'qr_scan',
  recorded_by uuid references profiles(id),
  recorded_at timestamptz not null default now(),
  unique (session_id, user_id)
);
create index idx_sschool_attendance_user on sunday_school_attendance(user_id, recorded_at desc);

-- ---------------------------------------------------------------------------
-- 8) صندوق الندوة
-- ---------------------------------------------------------------------------
create table symposium_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,  -- صاحب السؤال الحقيقي (يبقى محفوظًا دائمًا)
  is_anonymous boolean not null default false,
  stage_id app_stage not null references stages(id),
  question_text text not null,
  status question_status not null default 'new',
  assigned_to uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_symposium_stage_status on symposium_questions(stage_id, status);

create table symposium_question_notes (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references symposium_questions(id) on delete cascade,
  author_id uuid not null references profiles(id),
  note text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 9) الإشعارات
-- ---------------------------------------------------------------------------
create table notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  link_url text,
  target_type notification_target_type not null,
  target_stage app_stage references stages(id),
  target_role app_role,
  scheduled_at timestamptz,          -- فارغ يعني إرسال فوري
  sent_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table notification_recipients (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references notifications(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  channel notification_channel not null default 'in_app',
  read_at timestamptz,
  delivered_at timestamptz,
  unique (notification_id, user_id, channel)
);
create index idx_notif_recipients_user on notification_recipients(user_id, read_at);

create table user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  push_subscription jsonb not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 10) المسابقات
-- ---------------------------------------------------------------------------
create table quizzes (
  id uuid primary key default gen_random_uuid(),
  title_ar text not null,
  description_ar text,
  stage_id app_stage references stages(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  duration_seconds integer not null,
  max_attempts smallint not null default 1,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  question_type quiz_question_type not null,
  prompt text not null,
  sort_order smallint not null default 0,
  points smallint not null default 1
);

create table quiz_question_choices (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references quiz_questions(id) on delete cascade,
  choice_text text not null,
  is_correct boolean not null default false,
  sort_order smallint not null default 0
);

create table quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  attempt_number smallint not null,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score numeric(6,2),
  unique (quiz_id, user_id, attempt_number)
);
create index idx_quiz_attempts_user on quiz_attempts(user_id);

create table quiz_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references quiz_attempts(id) on delete cascade,
  question_id uuid not null references quiz_questions(id),
  selected_choice_ids uuid[] default '{}',
  text_answer text,
  is_correct boolean,
  unique (attempt_id, question_id)
);

-- ---------------------------------------------------------------------------
-- 11) سجل العمليات
-- ---------------------------------------------------------------------------
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null,             -- مثال: create_user, disable_user, change_role, change_stage...
  entity_type text not null,        -- مثال: profile, notification, quiz...
  entity_id text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index idx_audit_log_created on audit_log(created_at desc);
create index idx_audit_log_actor on audit_log(actor_id);

-- ---------------------------------------------------------------------------
-- 12) إعدادات التطبيق
-- ---------------------------------------------------------------------------
create table app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);

insert into app_settings (key, value) values
  ('activity_scoring', jsonb_build_object(
    'prayer_min_active_seconds_medium', 60,
    'prayer_min_active_seconds_high', 180,
    'prayer_min_progress_percent_likely_complete', 80,
    'reading_min_active_seconds_medium', 60,
    'reading_min_active_seconds_high', 180,
    'reading_min_progress_percent_likely_complete', 80
  ));

-- ---------------------------------------------------------------------------
-- updated_at تلقائي
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_profiles_updated before update on profiles
  for each row execute function set_updated_at();
create trigger trg_symposium_updated before update on symposium_questions
  for each row execute function set_updated_at();
