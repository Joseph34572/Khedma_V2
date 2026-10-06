import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { canManageContent } from "@/lib/roles";
import Link from "next/link";

export default async function BibleBooksPage() {
  const { supabase, user, role } = await getCurrentProfile();
  if (!user) redirect("/login");

  const [{ data: books }, { data: chapters }] = await Promise.all([
    supabase.from("bible_books").select("id, name_ar, testament, sort_order").order("sort_order"),
    supabase.from("bible_chapters").select("book_id")
  ]);

  const availableBookIds = new Set((chapters ?? []).map((c) => c.book_id));
  const oldBooks = (books ?? []).filter((b) => b.testament === "old" && availableBookIds.has(b.id));
  const newBooks = (books ?? []).filter((b) => b.testament === "new" && availableBookIds.has(b.id));

  return (
    <div className="max-w-xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-extrabold text-ink">الكتاب المقدس</h1>
        {role && canManageContent(role) && (
          <Link href="/servant/content/bible" className="text-sm font-bold text-primary hover:underline">
            ⚙️ استيراد إصحاحات
          </Link>
        )}
      </div>
      <p className="text-ink-soft text-sm mb-6">اختر السفر ثم الإصحاح للقراءة</p>

      {oldBooks.length === 0 && newBooks.length === 0 && (
        <div className="bg-white rounded-card border border-line p-8 text-center text-ink-soft">
          لم يتم استيراد أي أسفار بعد من الإدارة.
        </div>
      )}

      {oldBooks.length > 0 && (
        <>
          <h2 className="font-bold text-ink-soft text-sm mb-2">العهد القديم</h2>
          <BookGrid books={oldBooks} basePath="/servant/bible" />
        </>
      )}
      {newBooks.length > 0 && (
        <>
          <h2 className="font-bold text-ink-soft text-sm mt-6 mb-2">العهد الجديد</h2>
          <BookGrid books={newBooks} basePath="/servant/bible" />
        </>
      )}
    </div>
  );
}

function BookGrid({ books, basePath }: { books: { id: number; name_ar: string }[]; basePath: string }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {books.map((b) => (
        <Link key={b.id} href={`${basePath}/${b.id}`} className="bg-white rounded-lg border border-line p-3 text-center font-bold text-sm hover:border-primary">
          {b.name_ar}
        </Link>
      ))}
    </div>
  );
}
