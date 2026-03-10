"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Star, Ticket as TicketIcon } from "lucide-react";
import { supabase } from "@/lib/supabase-client";
import type { Ticket, TicketType } from "@/types/database";
import { TICKET_TYPE_LABELS } from "@/types/database";
import TicketForm from "./TicketForm";

interface TicketManagerProps {
  eventId: string;
  eventName: string;
}

export default function TicketManager({ eventId, eventName }: TicketManagerProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);

  useEffect(() => {
    fetchTickets();
  }, [eventId]);

  async function fetchTickets() {
    try {
      const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .eq("event_id", eventId)
        .order("price", { ascending: true });

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error("Biletler yüklenemedi:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu bilet türünü silmek istediğinizden emin misiniz?")) return;

    try {
      const { error } = await supabase.from("tickets").delete().eq("id", id);
      if (error) throw error;
      
      setTickets(tickets.filter(ticket => ticket.id !== id));
    } catch (error) {
      console.error("Bilet silinemedi:", error);
      alert("Bilet silinemedi. Lütfen tekrar deneyin.");
    }
  }

  function handleEdit(ticket: Ticket) {
    setEditingTicket(ticket);
    setShowForm(true);
  }

  function handleFormClose() {
    setShowForm(false);
    setEditingTicket(null);
  }

  function handleFormSubmit() {
    fetchTickets();
    handleFormClose();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {eventName} - Bilet Türleri
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            Bu etkinlik için bilet türlerini yönetin
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" />
          Bilet Türü Ekle
        </button>
      </div>

      {tickets.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          <TicketIcon className="h-12 w-12 mx-auto text-slate-300 mb-4" />
          <p className="font-medium">Henüz bilet türü yok</p>
          <p className="text-sm mt-2">İlk bilet türünü eklemek için butona tıklayın.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h4 className="font-semibold text-slate-900">{ticket.name}</h4>
                    {ticket.type === "vip" && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-yellow-400 to-yellow-600 text-white text-xs font-bold rounded-full">
                        <Star className="h-3 w-3" />
                        VIP
                      </span>
                    )}
                  </div>
                  
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-slate-600">
                      {ticket.description}
                    </p>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="font-bold text-primary-600">
                        €{ticket.price.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-slate-500">
                        {ticket.available}/{ticket.quantity} adet mevcut
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 ml-4">
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
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <TicketForm
          eventId={eventId}
          ticket={editingTicket}
          onClose={handleFormClose}
          onSubmit={handleFormSubmit}
        />
      )}
    </div>
  );
}
