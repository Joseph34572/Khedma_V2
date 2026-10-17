-- ============================================================================
-- تقييد محاولات تسجيل الدخول المتكررة (حماية من هجمات التخمين/القوة الغاشمة).
-- البيئة الحالية ما فيهاش Redis، فاستخدمنا جدول بسيط في نفس قاعدة بيانات
-- Supabase بدل عدّاد في الذاكرة (in-memory) — لأن عدّاد الذاكرة مش موثوق في
-- بيئة serverless (كل استدعاء ممكن يروح لنسخة مختلفة من الخادم مفيهاش نفس
-- العدّاد، زي Vercel). الجدول ده بديل عملي يشتغل صح في هذه البيئة، وموثّق هنا
-- إنه يمكن استبداله بـ Redis لاحقًا لو الحمل زاد كتير.
--
-- التصميم: نحسب عدد محاولات الدخول الفاشلة لكل رقم هاتف (identifier) خلال آخر
-- 15 دقيقة. لو وصلت 5 محاولات فاشلة، نمنع أي محاولة جديدة لنفس الرقم لحد ما
-- تنتهي مدة الانتظار (لا نستدعي Supabase Auth إطلاقًا في هذه الحالة، فمفيش
-- فرصة تخمين إضافية ولا إفصاح عن وجود/عدم وجود الحساب). التقييد بيبقى حسب
-- "الحساب" (رقم الهاتف) وليس الـ IP فقط، لأن عناوين IP المُرسَلة من العميل
-- (زي x-forwarded-for) مش موثوقة تمامًا دايمًا كمعرّف وحيد. القفل مؤقت (15
-- دقيقة فقط) ومش دائم، عشان حد خبيث ميقدرش يعمل "denial of service" بقفل
-- حساب شخص تاني للأبد.
create table if not exists login_attempts (
  id bigint generated always as identity primary key,
  identifier text not null,
  success boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists login_attempts_identifier_idx on login_attempts (identifier, created_at desc);

alter table login_attempts enable row level security;
-- مفيش أي policy لـ anon/authenticated على الجدول نفسه؛ الوصول الوحيد المسموح
-- به هو عبر الدالتين الآمنتين تحت (security definer)، فمحدش يقدر يقرأ أو يكتب
-- في الجدول مباشرة من العميل.

create or replace function login_rate_limit_check(p_identifier text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  fail_count int;
  oldest_fail timestamptz;
  window_seconds int := 900; -- 15 دقيقة
  max_fails int := 5;
  retry_after int := 0;
begin
  select count(*), min(created_at) into fail_count, oldest_fail
  from login_attempts
  where identifier = p_identifier
    and success = false
    and created_at > now() - make_interval(secs => window_seconds);

  if fail_count >= max_fails then
    retry_after := greatest(1, window_seconds - extract(epoch from (now() - oldest_fail))::int);
    return jsonb_build_object('allowed', false, 'retry_after_seconds', retry_after);
  end if;

  return jsonb_build_object('allowed', true, 'retry_after_seconds', 0);
end;
$$;

create or replace function login_rate_limit_record(p_identifier text, p_success boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into login_attempts (identifier, success) values (p_identifier, p_success);
  -- تنظيف السجلات القديمة (أكتر من ساعة) عشان الجدول مايكبرش من غير داعي بمرور الوقت.
  delete from login_attempts where created_at < now() - interval '1 hour';
end;
$$;

revoke all on function login_rate_limit_check(text) from public, anon, authenticated;
revoke all on function login_rate_limit_record(text, boolean) from public, anon, authenticated;
-- لازم "anon" يقدر ينادي الدالتين دول لأن فحص/تسجيل محاولة الدخول بيحصل *قبل*
-- ما يكون فيه session (المستخدم لسه بيحاول يسجّل دخول). الدالتين مش بيرجّعوا
-- أي بيانات حساسة (بس allowed/retry_after)، وبيكتبوا سطر واحد بسيط في جدول
-- داخلي مش متاح للقراءة المباشرة، فالمنح ده آمن ومحدود النطاق.
grant execute on function login_rate_limit_check(text) to anon, authenticated;
grant execute on function login_rate_limit_record(text, boolean) to anon, authenticated;
