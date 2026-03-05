import { createServerSupabase } from "@/lib/supabase-server";
import type { News, Event } from "@/types/database";
import HaberDetayClient from "./client";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

async function getNews(id: string): Promise<News | null> {
  try {
    const supabase = createServerSupabase();

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

async function getOtherNews(currentId: string, limit = 5): Promise<News[]> {
  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("news")
      .select("id, title, title_tr, title_de, title_en, published_at")
      .eq("is_published", true)
      .neq("id", currentId)
      .order("published_at", { ascending: false })
      .limit(limit);
    if (error) return [];
    return (data || []) as News[];
  } catch {
    return [];
  }
}

async function getUpcomingEvents(limit = 9): Promise<Event[]> {
  try {
    const supabase = createServerSupabase();
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("is_active", true)
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(limit);
    if (error) return [];
    return (data || []) as Event[];
  } catch {
    return [];
  }
}

/** Haber ID'sine göre her haberde farklı 3 etkinlik seç (deterministik) */
function pickEventsForNews(events: Event[], newsId: string, count = 3): Event[] {
  if (events.length <= count) return events;
  let hash = 0;
  for (let i = 0; i < newsId.length; i++) {
    hash = ((hash << 5) - hash + newsId.charCodeAt(i)) | 0;
  }
  const start = Math.abs(hash) % Math.max(1, events.length - count + 1);
  return events.slice(start, start + count);
}

export default async function HaberDetayPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const [haber, allEvents, otherNews] = await Promise.all([
    getNews(id),
    getUpcomingEvents(9),
    getOtherNews(id, 5),
  ]);
  const events = haber ? pickEventsForNews(allEvents, id, 3) : [];

  if (!haber) {
    const tNews = await getTranslations("newsDetail");
    const tCommon = await getTranslations("common");
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">{tNews("newsNotFound")}</h1>
          <p className="text-slate-600 mb-6">{tNews("newsNotFoundDesc")}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            {tCommon("backToHome")}
          </Link>
        </div>
      </div>
    );
  }

  return <HaberDetayClient haber={haber} events={events} otherNews={otherNews} locale={locale as "tr" | "de" | "en"} />;
}
