-- ============================================================================
-- تصحيح: الدالتين login_rate_limit_check و login_rate_limit_record كانتا
-- ممنوحتين لـ anon (أي زائر غير مسجَّل دخول)، لأن فحص/تسجيل محاولة الدخول
-- بيحصل قبل وجود session. المشكلة إن مفتاح anon علني بطبيعته (مكتوب في كل
-- صفحة من صفحات التطبيق)، فأي حد يقدر يستخدمه مباشرة (من غير المرور بكود
-- التطبيق خالص) وينادي login_rate_limit_record برقم هاتف أي حساب و
-- p_success = false خمس مرات متتالية، فيقفل الحساب ده 15 دقيقة — هجوم حجب
-- خدمة (denial of service) ضد أي مستخدم يعرف رقمه بس، من غير ما يحتاج كلمة
-- مروره. وكمان كان بيسمح بتضخيم الجدول بسجلات وهمية.
--
-- الإصلاح: نمنع anon و authenticated من نداء الدالتين تمامًا، ونخليهم يتنادوا
-- فقط بمفتاح service role (اللي موجود على السيرفر بس، مش متاح للعميل أبدًا).
-- كود التطبيق (app/login/actions.ts) بيتغيّر عشان يستخدم createServiceClient()
-- بدل العميل العادي لما ينادي الدالتين دول تحديدًا.
--
-- ملاحظة مهمة (حد معماري، مش حاجة ممكن تتصلح بالكود وحده): حتى بعد الإصلاح ده،
-- أي حد يقدر يستخدم مفتاح anon العلني عشان ينادي Supabase Auth API مباشرة
-- (POST /auth/v1/token?grant_type=password) من غير ما يمر بكود تطبيقنا خالص،
-- وفي الحالة دي تقييدنا هنا مش هيوقفه. الحماية الحقيقية من النوع ده بتيجي من
-- إعدادات Supabase نفسها (Dashboard → Authentication → Attack Protection /
-- Rate Limits، وتفعيل Captcha). تقييدنا هنا طبقة إضافية (defense in depth) على
-- مسار تسجيل الدخول العادي من واجهة التطبيق، مش بديل كامل عن إعدادات Supabase.
revoke execute on function login_rate_limit_check(text) from anon, authenticated;
revoke execute on function login_rate_limit_record(text, boolean) from anon, authenticated;

grant execute on function login_rate_limit_check(text) to service_role;
grant execute on function login_rate_limit_record(text, boolean) to service_role;
