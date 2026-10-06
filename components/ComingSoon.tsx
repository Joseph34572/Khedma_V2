export function ComingSoon({ title, phase }: { title: string; phase: string }) {
  return (
    <div>
      <h1 className="text-xl font-extrabold text-ink mb-2">{title}</h1>
      <div className="bg-white rounded-card border border-line p-8 text-center">
        <p className="text-ink-soft">
          هذا القسم جزء من {phase} من خطة التطوير، وسيتم بناؤه بالكامل (قاعدة بيانات وواجهة حقيقية) في الدفعة القادمة.
        </p>
      </div>
    </div>
  );
}
