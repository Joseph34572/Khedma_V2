-- ============================================================================
-- تحسينان على تقييد محاولات الدخول (migration 0014/0015):
--
-- 1) عدّاد الفشل كان بيفضل متراكم حتى بعد دخول ناجح — يعني لو حد غلط كلمة
--    السر 3 مرات وبعدين دخل صح، والمحاولات التالتة دي لسه محسوبة لو غلط تاني
--    بعد شوية، فبيتقفل أسرع من 5 محاولات فعلية جديدة. دالة جديدة
--    login_rate_limit_clear بتمسح سجل الفشل لمعرّف معيّن بعد نجاح الدخول.
--
-- 2) التقييد كان برقم الهاتف بس. لو حد عنده سكريبت بيجرّب كذا رقم هاتف من نفس
--    الجهاز (مش بالضرورة يعرف كلمة مرور أي حساب)، كل رقم كان بياخد 5 محاولات
--    لوحده. مفيش دالة SQL جديدة لازمة هنا — login_rate_limit_check/record
--    أصلًا بتاخد "p_identifier" كنص عام، فكود التطبيق (app/login/actions.ts)
--    بقى ينادّيهم مرتين: مرة برقم الهاتف، ومرة بمعرّف الـ IP (بصيغة
--    "ip:<address>")، بحد أعلى مختلف ومعقول (أعلى من حد الهاتف) لأن خدام كتير
--    ممكن يكونوا على نفس شبكة الكنيسة فمينفعش نقفلهم كلهم بسهولة بمجرد IP
--    واحد. ملاحظة: عنوان الـ IP بييجي من هيدر x-forwarded-for، وده موثوق بس
--    في بيئة زي Vercel اللي بتحط الهيدر ده بنفسها على حافة الشبكة (edge) —
--    مش قيمة ممرَّرة من المتصفح مباشرة.
create or replace function login_rate_limit_clear(p_identifier text) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from login_attempts where identifier = p_identifier and success = false;
end;
$$;

revoke all on function login_rate_limit_clear(text) from public, anon, authenticated;
grant execute on function login_rate_limit_clear(text) to service_role;

-- إعادة تعريف login_rate_limit_check بمعامل اختياري "p_max_fails" (افتراضيًا 5،
-- زي ما كان قبل كده بالظبط) عشان نقدر نستخدم حد أعلى لتقييد الـ IP. ملاحظة
-- مهمة: "create or replace" بيستبدل الدالة فقط لو نفس الاسم ونفس أنواع
-- المعاملات بالظبط؛ إضافة معامل جديد بتعتبره Postgres دالة "overload" منفصلة،
-- فكانت هتفضل الدالة القديمة (نسخة بمعامل واحد) موجودة جنب الجديدة، وده ممكن
-- يلخبط PostgREST في تحديد أي نسخة ينادي لما العميل يبعت p_identifier بس. عشان
-- كده بنشيل النسخة القديمة بمعامل واحد صراحةً الأول.
drop function if exists login_rate_limit_check(text);

create or replace function login_rate_limit_check(p_identifier text, p_max_fails int default 5) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  fail_count int;
  oldest_fail timestamptz;
  window_seconds int := 900; -- 15 دقيقة
  retry_after int := 0;
begin
  select count(*), min(created_at) into fail_count, oldest_fail
  from login_attempts
  where identifier = p_identifier
    and success = false
    and created_at > now() - make_interval(secs => window_seconds);

  if fail_count >= p_max_fails then
    retry_after := greatest(1, window_seconds - extract(epoch from (now() - oldest_fail))::int);
    return jsonb_build_object('allowed', false, 'retry_after_seconds', retry_after);
  end if;

  return jsonb_build_object('allowed', true, 'retry_after_seconds', 0);
end;
$$;

revoke all on function login_rate_limit_check(text, int) from public, anon, authenticated;
grant execute on function login_rate_limit_check(text, int) to service_role;
