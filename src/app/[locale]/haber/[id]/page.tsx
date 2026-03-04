import { createServerSupabase } from "@/lib/supabase-server";
import type { News } from "@/types/database";
import HaberDetayClient from "./client";

async function getNews(id: string): Promise<News | null> {
  try {
    const supabase = await createServerSupabase();

    const { data, error } = await supabase
      .from("news")
      .select("*")
      .eq("id", id)
      .eq("is_published", true)
      .single();

    if (error) {
      console.error("News fetch error:", error);
      return null;
    }

    return data as News;
  } catch (error) {
    console.error("Fetch news error:", error);
    return null;
  }
}

export default async function HaberDetayPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const haber = await getNews(id);

  if (!haber) {
    // Geçici olarak ana sayfaya yönlendir
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Haber Bulunamadı</h1>
          <p className="text-slate-600 mb-6">Aradığınız haber mevcut değil veya kaldırılmış.</p>
          <a 
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Ana Sayfaya Dön
          </a>
        </div>
      </div>
    );
  }

  return <HaberDetayClient haber={haber} locale={locale as "tr" | "de" | "en"} />;
}
