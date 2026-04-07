import Header from "@/components/Header";
import EventCalendar from "@/components/EventCalendar";
import { getEventsForCalendar } from "@/lib/events-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TakvimPage() {
  try {
    const events = await getEventsForCalendar();

    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        
        <main className="container mx-auto px-4 py-8">
          <EventCalendar events={events} />
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-white py-8 mt-16">
          <div className="container mx-auto px-4 text-center text-sm text-slate-500">
            {new Date().getFullYear()} EventSeat
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
