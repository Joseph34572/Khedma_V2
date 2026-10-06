import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";

export default async function BookChaptersPage({ params }: { params: { bookId: string } }) {
  const { supabase, user } = await getCurrentProfile();
  if (!user) redirect("/login");

  const bookId = Number(params.bookId);
  const { data: book } = await supabase.from("bible_books").select("id, name_ar").eq("id", bookId).single();
  if (!book) notFound();

  const { data: chapters } = await supabase
    .from("bible_chapters")
    .select("id, chapter_number")
    .eq("book_id", bookId)
    .order("chapter_number");

  return (
    <div className="max-w-xl">
      <Link href="/child/bible" className="text-sm text-ink-soft hover:underline">‹ رجوع للأسفار</Link>
      <h1 className="text-xl font-extrabold text-ink mt-2 mb-5">{book.name_ar}</h1>

      <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
        {(chapters ?? []).map((c) => (
          <Link
            key={c.id}
            href={`/child/bible/${bookId}/${c.chapter_number}`}
            className="bg-white rounded-lg border border-line py-2.5 text-center font-bold hover:border-primary"
          >
            {c.chapter_number}
          </Link>
        ))}
        {(!chapters || chapters.length === 0) && <p className="col-span-full text-ink-soft text-sm">لا توجد إصحاحات مستوردة لهذا السفر بعد.</p>}
      </div>
    </div>
  );
}
