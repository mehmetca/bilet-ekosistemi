"use client";

import { useState, useEffect } from "react";
import { Bell, Search } from "lucide-react";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { supabase } from "@/lib/supabase-client";
import Link from "next/link";

type ReminderRow = {
  id: string;
  event_id: string;
  email: string;
  created_at: string;
  reminder_sent_at: string | null;
  events: { title: string; date: string; time: string; venue: string; slug?: string } | null;
};

export default function EtkinlikUyarilariPage() {
  const { isAdmin, loading: authLoading } = useSimpleAuth();
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    fetchReminders();
  }, [isAdmin]);

  async function fetchReminders() {
    try {
      const { data } = await supabase
        .from("event_reminders")
        .select(`
          id,
          event_id,
          email,
          created_at,
          reminder_sent_at,
          events (
            title,
            date,
            time,
            venue,
            slug
          )
        `)
        .order("created_at", { ascending: false });

      setReminders((data as unknown as ReminderRow[]) || []);
    } catch (error) {
      console.error("Reminders fetch error:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredReminders = reminders.filter(
    (r) =>
      r.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.events?.title || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isAdmin) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <Bell className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-red-800 mb-2">Erişim Reddedildi</h2>
          <p className="text-red-600">Bu sayfaya sadece yöneticiler erişebilir.</p>
        </div>
      </div>
    );
  }

  if (authLoading || loading) {
    return (
      <div className="p-8">
        <div className="text-center text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Etkinlik Uyarıları</h1>
        <p className="text-slate-600 mb-8">
          Bilet uyarısı için e-posta kaydı yapan kullanıcılar. Etkinlikten önce hatırlatma maili gönderilir.
        </p>

        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="E-posta veya etkinlik adıyla ara..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left p-4 text-sm font-medium text-slate-700">E-posta</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-700">Etkinlik</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-700">Kayıt Tarihi</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-700">Hatırlatma</th>
                </tr>
              </thead>
              <tbody>
                {filteredReminders.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500">
                      Henüz kayıt yok. Kullanıcılar etkinlik sayfalarında &quot;Bilet Uyarısı&quot; ile e-posta kaydedebilir.
                    </td>
                  </tr>
                ) : (
                  filteredReminders.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="p-4 text-sm text-slate-900">{r.email}</td>
                      <td className="p-4 text-sm">
                        {r.events ? (
                          <Link
                            href={`/etkinlik/${r.events.slug || r.event_id}`}
                            className="text-primary-600 hover:underline"
                          >
                            <div className="font-medium">{r.events.title}</div>
                            <div className="text-xs text-slate-500">
                              {new Date(r.events.date).toLocaleDateString("tr-TR")} • {r.events.venue}
                            </div>
                          </Link>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-4 text-sm text-slate-600">
                        {new Date(r.created_at).toLocaleString("tr-TR")}
                      </td>
                      <td className="p-4 text-sm">
                        {r.reminder_sent_at ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Gönderildi ({new Date(r.reminder_sent_at).toLocaleDateString("tr-TR")})
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            Bekliyor
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
