import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { BibleReader } from "@/components/BibleReader";

export default async function ChapterReadPage({ params }: { params: { bookId: string; chapterNumber: string } }) {
  const { supabase, user } = await getCurrentProfile();
  if (!user) redirect("/login");

  const bookId = Number(params.bookId);
  const chapterNumber = Number(params.chapterNumber);

  const { data: book } = await supabase.from("bible_books").select("name_ar").eq("id", bookId).single();
  const { data: chapter } = await supabase
    .from("bible_chapters")
    .select("id")
    .eq("book_id", bookId)
    .eq("chapter_number", chapterNumber)
    .single();

  if (!book || !chapter) notFound();

  const { data: verses } = await supabase
    .from("bible_verses")
    .select("verse_number, text_ar")
    .eq("chapter_id", chapter.id)
    .order("verse_number");

  return (
    <BibleReader
      chapterId={chapter.id}
      bookName={book.name_ar}
      chapterNumber={chapterNumber}
      verses={verses ?? []}
      backHref={`/child/bible/${bookId}`}
    />
  );
}
