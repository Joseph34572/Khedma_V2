// Service worker بسيط جدًا: وجوده بيخلّي المتصفح يعتبر الموقع "تطبيق قابل للتثبيت"
// (زرار "ثبّت التطبيق" وفتحه بملء الشاشة من الأيقونة). متعمّد إنه ميخزّنش أي صفحات
// أو بيانات (no caching): التطبيق كل بياناته شخصية ومتغيرة، والتخزين كان هيرجّع
// بيانات قديمة أو بيانات مستخدم تاني على نفس الجهاز.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // من غير respondWith: كل الطلبات بتروح للشبكة عادي زي من غير service worker.
});
