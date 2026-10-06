-- ============================================================================
-- إصلاح: الإشعارات لم تكن تصل لأي مستخدم لأن سياسة notifications_admin_write
-- (for all) كانت تمنح القراءة للمدير/الأمين العام وأمين الخدمة فقط؛ أي مستلم
-- آخر (خادم أو ولد) لم يكن يملك أي صلاحية SELECT على جدول notifications نفسه،
-- فكان الـ join من notification_recipients إلى notifications يرجع فارغًا دائمًا.
-- هذه السياسة الإضافية (permissive، تُضاف بـ OR على ما سبق) تتيح لأي مستخدم
-- قراءة الإشعار فقط إذا كان من ضمن مستلميه الفعليين.
-- ============================================================================
create policy notifications_recipient_select on notifications for select
  using (
    exists (
      select 1 from notification_recipients nr
      where nr.notification_id = notifications.id and nr.user_id = auth.uid()
    )
  );

-- دعم استهداف الإشعارات بمجموعات محددة (أولاد/خدام/أمناء كل مرحلة، أمين عام،
-- مدير عام) بدل الأنواع العامة السابقة فقط.
alter type notification_target_type add value if not exists 'custom';
