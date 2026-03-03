import Header from "@/components/Header";
import EventCalendar from "@/components/EventCalendar";
import { createServerSupabase } from "@/lib/supabase-server";
import type { Event } from "@/types/database";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getEvents(): Promise<Event[]> {
  try {
    const supabase = await createServerSupabase();
    
    // Events tablosundan veri çek
    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("*")
      .order("date", { ascending: true });
    
    // Tour events tablosundan veri çek
    const { data: tourEvents, error: tourEventsError } = await supabase
      .from("tour_events")
      .select(`
        *,
        artists!inner (
          name,
          slug,
          image_url
        )
      `)
      .order("event_date", { ascending: true });
    
    if (eventsError) {
      console.error("Events fetch error:", eventsError);
      return [];
    }
    
    if (tourEventsError) {
      console.error("Tour events fetch error:", tourEventsError);
      return [];
    }
    
    // Tour events'i events formatına dönüştür
    type ServerTourEvent = {
      id: string;
      artists: { name?: string; image_url?: string };
      city: string;
      event_date: string;
      venue: string;
      price?: number;
      ticket_url?: string;
      created_at?: string;
    };

    const formattedTourEvents = (tourEvents ?? []).map((te: ServerTourEvent) => ({
      id: te.id,
      title: `${te.artists?.name ?? ""} - ${te.city}`,
      date: te.event_date.split('T')[0],
      time: te.event_date.split('T')[1]?.substring(0, 5) || '20:00',
      venue: te.venue,
      location: te.city,
      category: 'konser',
      price_from: te.price,
      ticket_url: te.ticket_url,
      image_url: te.artists?.image_url || null,
      created_at: te.created_at || new Date().toISOString()
    }));
    
    // İki listeyi birleştir
    const allEvents = [...(events ?? []), ...formattedTourEvents];
    
    return allEvents as Event[];
  } catch (error) {
    console.error("Fetch events error:", error);
    return [];
  }
}

export default async function TakvimPage() {
  try {
    const events = await getEvents();

    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        
        <main className="container mx-auto px-4 py-8">
          <EventCalendar events={events} />
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-white py-8 mt-16">
          <div className="container mx-auto px-4 text-center text-sm text-slate-500">
            © {new Date().getFullYear()} Bilet Ekosistemi
          </div>
        </footer>
      </div>
    );
  } catch (error) {
    console.error("TakvimPage error:", error);
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Hata Oluştu</h1>
          <p className="text-slate-600">Takvim sayfası yüklenirken bir hata oluştu.</p>
        </div>
      </div>
    );
  }
}
