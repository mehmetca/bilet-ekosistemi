"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Ticket, AlertCircle } from "lucide-react";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import AdminOnlyGuard from "@/components/AdminOnlyGuard";
import { supabase } from "@/lib/supabase-client";
import { EVENT_TICKET_TYPE_PRESET_LABELS } from "@/lib/ticket-type-presets";
import type { Event } from "@/types/database";

interface TicketType {
  id: string;
  event_id: string;
  name: string;
  type: 'normal' | 'vip';
  price: number;
  quantity?: number;
  available?: number;
  description?: string;
  events?: {
    title: string;
  };
}

const PRESET_TICKET_NAMES = [...EVENT_TICKET_TYPE_PRESET_LABELS];

export default function BiletTurleriPage() {
  const { isAdmin } = useSimpleAuth();
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTicket, setEditingTicket] = useState<TicketType | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    fetchData();
  }, [isAdmin]);

  async function fetchData() {
    try {
      // Etkinlikleri çek
      const { data: eventsData } = await supabase
        .from("events")
        .select("id, title")
        .order("title");

      // Bilet türlerini çek
      const { data: ticketsData } = await supabase
        .from("tickets")
        .select(`
          *,
          events (
            title
          )
        `)
        .order("created_at", { ascending: false });

      setEvents((eventsData || []) as unknown as Event[]);
      setTicketTypes(ticketsData || []);
    } catch (error) {
      console.error("Data fetch error:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu bilet türünü silmek istediğinizden emin misiniz?")) return;

    try {
      const { error } = await supabase.from("tickets").delete().eq("id", id);
      if (error) throw error;
      
      setTicketTypes(ticketTypes.filter(ticket => ticket.id !== id));
    } catch (error) {
      console.error("Bilet türü silinemedi:", error);
      alert("Bilet türü silinemedi. Lütfen tekrar deneyin.");
    }
  }

  function handleEdit(ticket: TicketType) {
    setEditingTicket(ticket);
    setShowForm(true);
  }

  function handleFormClose() {
    setShowForm(false);
    setEditingTicket(null);
  }

  async function handleFormSubmit(formData: FormData) {
    try {
      const ticketData = {
        event_id: formData.get("event_id") as string,
        name: formData.get("name") as string,
        type: formData.get("type") as 'normal' | 'vip',
        price: parseFloat(formData.get("price") as string),
        quantity: parseInt(formData.get("quantity") as string, 10),
        description: formData.get("description") as string || null,
      };

      

      if (editingTicket) {
        const sold = Math.max(
          0,
          Number(editingTicket.quantity || 0) - Number(editingTicket.available || 0)
        );
        const available = Math.max(0, Number(ticketData.quantity) - sold);

        // Güncelleme
        const { error } = await supabase
          .from("tickets")
          .update({
            ...ticketData,
            available,
          })
          .eq("id", editingTicket.id);

        if (error) {
          console.error("Update error:", error);
          throw error;
        }
        
      } else {
        const available = Math.max(0, Number(ticketData.quantity || 0));
        // Yeni bilet türü
        const { error } = await supabase
          .from("tickets")
          .insert({
            ...ticketData,
            available,
          });

        if (error) {
          console.error("Insert error:", error);
          throw error;
        }
        
      }

      await fetchData();
      handleFormClose();
      alert(editingTicket ? "Bilet türü güncellendi!" : "Bilet türü oluşturuldu!");
    } catch (error) {
      console.error("Form submit error:", error);
      alert("İşlem başarısız oldu: " + (error as Error).message);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <AdminOnlyGuard>
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Bilet Türleri Yönetimi</h1>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            Yeni Bilet Türü
          </button>
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-6">
                {editingTicket ? "Bilet Türü Düzenle" : "Yeni Bilet Türü"}
              </h2>
              
              <form action={handleFormSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Etkinlik
                  </label>
                  <select
                    name="event_id"
                    required
                    defaultValue={editingTicket?.event_id || ""}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                  >
                    <option value="">Etkinlik seçin</option>
                    {events.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Bilet Adı
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    defaultValue={editingTicket?.name || ""}
                    placeholder="Bilet türü seçin"
                    list="preset-ticket-types"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                  />
                  <datalist id="preset-ticket-types">
                    {PRESET_TICKET_NAMES.map((ticketName) => (
                      <option key={ticketName} value={ticketName} />
                    ))}
                  </datalist>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Tür
                    </label>
                    <select
                      name="type"
                      required
                      defaultValue={editingTicket?.type || "normal"}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                    >
                      <option value="normal">Normal</option>
                      <option value="vip">VIP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Fiyat (€)
                    </label>
                    <input
                      type="number"
                      name="price"
                      min="0"
                      step="0.01"
                      required
                      defaultValue={editingTicket?.price || ""}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Stok (Adet)
                  </label>
                  <input
                    type="number"
                      name="quantity"
                    min="0"
                    required
                      defaultValue={editingTicket?.quantity || ""}
                    placeholder="Kaç adet bilet olacak?"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Açıklama (Opsiyonel)
                  </label>
                  <textarea
                    name="description"
                    rows={3}
                    defaultValue={editingTicket?.description || ""}
                    placeholder="Bilet türü hakkında ek bilgiler..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-primary-700"
                  >
                    {editingTicket ? "Güncelle" : "Oluştur"}
                  </button>
                  <button
                    type="button"
                    onClick={handleFormClose}
                    className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                  >
                    İptal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {ticketTypes.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
            <Ticket className="h-16 w-16 mx-auto text-slate-300 mb-4" />
            <p className="text-lg font-medium">Henüz bilet türü yok</p>
            <p className="mt-2 text-sm">İlk bilet türünü eklemek için "Yeni Bilet Türü" butonuna tıklayın.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left p-4 text-sm font-medium text-slate-700">Etkinlik</th>
                    <th className="text-left p-4 text-sm font-medium text-slate-700">Bilet Adı</th>
                    <th className="text-left p-4 text-sm font-medium text-slate-700">Tür</th>
                    <th className="text-left p-4 text-sm font-medium text-slate-700">Fiyat</th>
                    <th className="text-left p-4 text-sm font-medium text-slate-700">Stok</th>
                    <th className="text-left p-4 text-sm font-medium text-slate-700">Satılan</th>
                    <th className="text-left p-4 text-sm font-medium text-slate-700">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {ticketTypes.map((ticket) => (
                    <tr key={ticket.id} className="border-b border-slate-100">
                      <td className="p-4 text-sm text-slate-900">
                        {ticket.events?.title}
                      </td>
                      <td className="p-4 text-sm text-slate-900">
                        <div>
                          <div className="font-medium">{ticket.name}</div>
                          {ticket.description && (
                            <div className="text-xs text-slate-500">{ticket.description}</div>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-sm">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          ticket.type === 'vip' 
                            ? 'bg-yellow-100 text-yellow-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {ticket.type === 'vip' ? 'VIP 🌟' : 'Normal'}
                        </span>
                      </td>
                      <td className="p-4 text-sm font-medium text-slate-900">
                        €{ticket.price.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-sm text-slate-900">
                        <span className="font-medium text-slate-900">
                          {ticket.quantity || 0}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-slate-900">
                        {Math.max(0, Number(ticket.quantity || 0) - Number(ticket.available || 0))}
                      </td>
                      <td className="p-4 text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(ticket)}
                            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(ticket.id)}
                            className="p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
    </AdminOnlyGuard>
  );
}
