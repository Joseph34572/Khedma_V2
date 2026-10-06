import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { canManageContent } from "@/lib/roles";
import { ImportChapterForm } from "./ImportChapterForm";

export async function BibleContentPage() {
  const { supabase, user, role } = await getCurrentProfile();
  if (!user) redirect("/login");
  if (!role || !canManageContent(role)) redirect("/");

  const [{ data: books }, { data: chapters }] = await Promise.all([
    supabase.from("bible_books").select("id, name_ar, testament").order("sort_order"),
    supabase.from("bible_chapters").select("book_id, chapter_number").order("chapter_number")
  ]);

  const importedByBook = new Map<number, number[]>();
  (chapters ?? []).forEach((c) => {
    const list = importedByBook.get(c.book_id) ?? [];
    list.push(c.chapter_number);
    importedByBook.set(c.book_id, list);
  });

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-extrabold text-ink mb-1">محتوى الكتاب المقدس</h1>
      <p className="text-ink-soft text-sm mb-6">
        استورد إصحاحًا كاملًا بلصق نصه من مصدر معتمد، آية في كل سطر بالصيغة:
        <br /><code dir="ltr" className="bg-parchment px-1.5 py-0.5 rounded">1 في البدء خلق الله السماوات والأرض.</code>
      </p>

      <ImportChapterForm books={books ?? []} />

      <h2 className="font-bold text-ink mt-8 mb-3">الإصحاحات المستوردة حتى الآن</h2>
      <div className="bg-white rounded-card border border-line p-4 text-sm space-y-1 max-h-64 overflow-y-auto">
        {(books ?? [])
          .filter((b) => importedByBook.has(b.id))
          .map((b) => (
            <p key={b.id}>
              <span className="font-bold">{b.name_ar}</span>:{" "}
              <span className="text-ink-soft">{importedByBook.get(b.id)!.sort((a, c) => a - c).join("، ")}</span>
            </p>
          ))}
        {importedByBook.size === 0 && <p className="text-ink-soft">لا يوجد إصحاحات مستوردة بعد.</p>}
      </div>
    </div>
  );
}
