import Header from "@/components/Header";
import EventCalendar from "@/components/EventCalendar";
import { createClient } from "@supabase/supabase-js";
import type { Event } from "@/types/database";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getEvents(): Promise<Event[]> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return [];
    const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("*")
      .eq("is_active", true)
      .order("date", { ascending: true });

    if (eventsError) {
      console.error("Events fetch error:", eventsError);
      return [];
    }

    return (events ?? []) as Event[];
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
