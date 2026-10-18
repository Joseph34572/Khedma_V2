-- ---------------------------------------------------------------------------
-- 0022: تقوية الأمان بعد الفحص الأمني الشامل.
--
-- ⚠️ ترتيب التطبيق مهم: اعمل deploy لكود التطبيق الجديد الأول (اللي بيبعت هيدر
-- x-khedma-origin مع كل كتابة)، وبعدين شغّل الملف ده. لو اتشغّل قبل الكود الجديد،
-- كل عمليات الحفظ من الموقع القديم هتترفض لحد ما الـ deploy يخلص.
--
-- 1) الحساب المعطّل: بيتحظر فعليًا في Supabase Auth (مش في التطبيق بس)، وكل
--    الصلاحيات بقت تتطلب إن الحساب نشط.
-- 2) أي حساب Auth ملوش بروفايل نشط (مثلًا حد عمل sign up مباشر) مش بيقرا حاجة.
-- 3) تقييد محاولات الدخول بقى ذرّي (atomic)، والدخول الناجح مبيصفّرش عدّاد الـ IP.
-- 4) الكتابة في قاعدة البيانات بقت من سيرفر التطبيق بس: أي INSERT/UPDATE/DELETE
--    جاي من مستخدم مباشرة على الـ API (من غير الموقع) بيترفض. ده بيقفل التلاعب
--    بالنشاط والحضور، والتعديل من غير ما يتسجّل في سجل العمليات.
-- 5) تقفيل أعمدة: محدش يعدّل بروفايله بنفسه، والإشعار يتعلّم "مقروء" بس.
-- 6) حضور مدارس الأحد لازم يكون لولد من نفس مرحلة الحصة، والتسجيل الذاتي
--    لحضور القداس بقى لآخر 7 أيام بس.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1) الحساب المعطّل
-- ===========================================================================

-- الدور بيرجع null لو الحساب مش نشط، فكل سياسة فيها auth_role() <> 'member'
-- (صلاحيات الخدام على المحتوى والمسابقات والندوة) بتقفل تلقائيًا للمعطّل.
create or replace function auth_role() returns app_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and status = 'active';
$$;

-- مزامنة حالة البروفايل مع الحظر في Supabase Auth: لو اتعطّل من أي مكان (حتى من
-- SQL Editor)، بيتمنع من الدخول وتجديد الجلسة، وجلساته المفتوحة بتتقفل.
create or replace function sync_profile_ban() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'disabled' then
      update auth.users set banned_until = now() + interval '87600 hours' where id = new.id;
      delete from auth.sessions where user_id = new.id;
    else
      update auth.users set banned_until = null where id = new.id;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function sync_profile_ban() from public, anon, authenticated;

drop trigger if exists trg_profiles_sync_ban on profiles;
create trigger trg_profiles_sync_ban
  after update of status on profiles
  for each row execute function sync_profile_ban();

-- الحسابات المعطّلة حاليًا اللي ماتحظرتش في Auth (اتعطّلت قبل ما الحظر يتضاف).
update auth.users u set banned_until = now() + interval '87600 hours'
from profiles p
where p.id = u.id and p.status = 'disabled' and (u.banned_until is null or u.banned_until < now());
delete from auth.sessions s using profiles p where p.id = s.user_id and p.status = 'disabled';

-- ===========================================================================
-- 2) القراءة لأصحاب الحسابات النشطة بس (بدل "أي حد مسجّل دخول")
-- ===========================================================================
drop policy if exists app_settings_select on app_settings;
create policy app_settings_select on app_settings for select using (auth_status() = 'active');

drop policy if exists bible_books_select on bible_books;
create policy bible_books_select on bible_books for select using (auth_status() = 'active');

drop policy if exists bible_chapters_select on bible_chapters;
create policy bible_chapters_select on bible_chapters for select using (auth_status() = 'active');

drop policy if exists bible_verses_select on bible_verses;
create policy bible_verses_select on bible_verses for select using (auth_status() = 'active');

drop policy if exists masses_select on masses;
create policy masses_select on masses for select using (auth_status() = 'active');

drop policy if exists stages_select on stages;
create policy stages_select on stages for select using (auth_status() = 'active');

drop policy if exists prayer_contents_select on prayer_contents;
create policy prayer_contents_select on prayer_contents for select
  using (auth_status() = 'active' and is_active);

drop policy if exists prayer_sections_select on prayer_sections;
create policy prayer_sections_select on prayer_sections for select
  using (
    auth_status() = 'active'
    and exists (select 1 from prayer_contents p where p.id = prayer_sections.prayer_content_id and p.is_active)
  );

-- ===========================================================================
-- 3) تقييد محاولات الدخول — فحص وتسجيل في خطوة واحدة
-- ===========================================================================
-- المحاولة بتتسجّل "فاشلة" مقدّمًا وقت الفحص نفسه (تحت قفل على المعرّف)، فالطلبات
-- المتوازية مبتعدّيش كلها قبل ما أي واحدة فيهم تتحسب. لو الدخول نجح بعد كده،
-- login_rate_limit_resolve بتحوّلها لناجحة.
create or replace function login_rate_limit_attempt(p_identifier text, p_max_fails int default 5) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  fail_count int;
  oldest_fail timestamptz;
  window_seconds int := 900; -- 15 دقيقة
  new_id bigint;
begin
  perform pg_advisory_xact_lock(hashtext('login:' || p_identifier));

  select count(*), min(created_at) into fail_count, oldest_fail
  from login_attempts
  where identifier = p_identifier
    and success = false
    and created_at > now() - make_interval(secs => window_seconds);

  if fail_count >= p_max_fails then
    return jsonb_build_object(
      'allowed', false,
      'retry_after_seconds', greatest(1, window_seconds - extract(epoch from (now() - oldest_fail))::int)
    );
  end if;

  insert into login_attempts (identifier, success) values (p_identifier, false) returning id into new_id;
  delete from login_attempts where created_at < now() - interval '1 hour';
  return jsonb_build_object('allowed', true, 'retry_after_seconds', 0, 'attempt_id', new_id);
end;
$$;

-- نجاح الدخول: المحاولة نفسها بتتعلّم ناجحة. p_clear = true (لرقم الهاتف بس) بتمسح
-- الفشل القديم لنفس الرقم. عدّاد الـ IP مبيتمسحش أبدًا بالنجاح، عشان محدش يقدر
-- يصفّره بدخول صحيح على حسابه وبعدين يكمّل تخمين على أرقام تانية.
create or replace function login_rate_limit_resolve(p_attempt_id bigint, p_clear boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare
  ident text;
begin
  update login_attempts set success = true where id = p_attempt_id returning identifier into ident;
  if p_clear and ident is not null then
    delete from login_attempts where identifier = ident and success = false;
  end if;
end;
$$;

revoke all on function login_rate_limit_attempt(text, int) from public, anon, authenticated;
revoke all on function login_rate_limit_resolve(bigint, boolean) from public, anon, authenticated;
grant execute on function login_rate_limit_attempt(text, int) to service_role;
grant execute on function login_rate_limit_resolve(bigint, boolean) to service_role;

-- ===========================================================================
-- 4) الكتابة من سيرفر التطبيق بس
-- ===========================================================================
-- سيرفر التطبيق بيقرا المفتاح ده بمفتاح الخدمة (service role) ويبعته في هيدر
-- x-khedma-origin مع كل طلب كتابة باسم المستخدم. المفتاح عمره ما بيوصل للمتصفح.
-- المستخدم اللي بيكلّم الـ API مباشرة (بالتوكن بتاعه) معندوش المفتاح، فكتابته
-- بتترفض حتى لو سياسات RLS كانت هتسمح بيها. القراءة مش متأثرة.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
-- service_role (عميل الخدمة في السيرفر) لازم يوصل للـ schema كمان، وإلا أي كتابة
-- بيه (سجل العمليات، الحسابات، المسابقات) بتفشل بـ "permission denied for schema private".
grant usage on schema private to anon, authenticated, service_role;

create table if not exists private.app_origin (
  id boolean primary key default true check (id),
  key text not null
);
revoke all on private.app_origin from public, anon, authenticated;
insert into private.app_origin (key)
values (replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (id) do nothing;

create or replace function app_origin_key() returns text
language sql stable security definer set search_path = public as $$
  select key from private.app_origin;
$$;
revoke all on function app_origin_key() from public, anon, authenticated;
grant execute on function app_origin_key() to service_role;

-- تغيير المفتاح (لو اتسرّب): السيرفر بيلاحظ الرفض ويجيب المفتاح الجديد لوحده.
--   update private.app_origin set key = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

create or replace function private.app_origin_ok() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from private.app_origin
    where key = coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-khedma-origin', '')
  );
$$;
revoke all on function private.app_origin_ok() from public;
grant execute on function private.app_origin_ok() to anon, authenticated, service_role;

-- الفحص بيحصل بس لما الكتابة جاية مباشرة بدور المستخدم (anon/authenticated). جوّه
-- دوال SECURITY DEFINER (زي symposium_assign) الدور بيبقى صاحب الدالة، والدوال
-- دي بتعمل فحص الصلاحيات بنفسها. مفتاح الخدمة (service_role) مش متأثر.
create or replace function private.enforce_app_origin() returns trigger
language plpgsql as $$
begin
  -- الشرطين منفصلين عن قصد: أي دور تاني (service_role، أدوار Supabase الداخلية)
  -- مبيوصلش أصلًا لنداء الدالة اللي في schema private.
  if current_user in ('anon', 'authenticated') then
    if not private.app_origin_ok() then
      raise exception 'الكتابة المباشرة غير مسموحة؛ استخدم التطبيق' using errcode = '42501';
    end if;
  end if;
  return null;
end;
$$;
revoke all on function private.enforce_app_origin() from public;
grant execute on function private.enforce_app_origin() to anon, authenticated, service_role;

do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('drop trigger if exists trg_enforce_app_origin on public.%I', t.tablename);
    execute format(
      'create trigger trg_enforce_app_origin before insert or update or delete on public.%I
         for each statement execute function private.enforce_app_origin()',
      t.tablename
    );
    -- TRUNCATE مش بيخضع لـ RLS؛ مفيش أي سبب إن المستخدمين يكون معاهم الصلاحية دي.
    execute format('revoke truncate on public.%I from anon, authenticated', t.tablename);
  end loop;
end;
$$;

-- ===========================================================================
-- 5) تقفيل أعمدة
-- ===========================================================================
-- البروفايلات بتتعدّل من إجراءات السيرفر بمفتاح الخدمة بس (بعد فحص الصلاحيات)،
-- فمفيش داعي إن المستخدم نفسه يقدر يغيّر اسمه أو رمز الـ QR بتاعه.
revoke insert, update, delete on profiles from anon, authenticated;
drop policy if exists profiles_update_self on profiles;

-- إيصال الإشعار: المستخدم يقدر يعلّمه "مقروء" بس، مش يغيّر الإشعار المربوط بيه.
revoke update on notification_recipients from anon, authenticated;
grant update (read_at) on notification_recipients to authenticated;

-- ===========================================================================
-- 6) الحضور
-- ===========================================================================
drop policy if exists sschool_attendance_staff_insert on sunday_school_attendance;
create policy sschool_attendance_staff_insert on sunday_school_attendance for insert
  with check (
    recorded_by = auth.uid()
    and auth_role() <> 'member'
    and can_view_user(user_id)
    and exists (
      select 1
      from sunday_school_sessions s
      join profiles p on p.id = sunday_school_attendance.user_id
      where s.id = sunday_school_attendance.session_id
        and p.stage_id = s.stage_id
        and p.role = 'member'
    )
  );

drop policy if exists mass_attendance_owner_insert on mass_attendance;
create policy mass_attendance_owner_insert on mass_attendance for insert
  with check (
    user_id = auth.uid()
    and method = 'self_report'
    and auth_status() = 'active'
    and exists (
      select 1 from masses m
      where m.id = mass_attendance.mass_id
        and m.mass_date between (now() at time zone 'Africa/Cairo')::date - 7
                            and (now() at time zone 'Africa/Cairo')::date
    )
  );

-- ===========================================================================
-- 7) متفرقات من تحذيرات Supabase
-- ===========================================================================
create or replace function set_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
