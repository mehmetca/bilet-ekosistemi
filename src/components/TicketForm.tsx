"use client";

import { useState, useEffect } from "react";
import { X, Save } from "lucide-react";
import { supabase } from "@/lib/supabase-client";
import type { Ticket, TicketType } from "@/types/database";
import { TICKET_TYPE_LABELS } from "@/types/database";

interface TicketFormProps {
  eventId: string;
  ticket?: Ticket | null;
  onClose: () => void;
  onSubmit: () => void;
}

export default function TicketForm({ eventId, ticket, onClose, onSubmit }: TicketFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    type: "normal" as TicketType,
    price: 0,
    quantity: 100,
    available: 100,
    description: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ticket) {
      setFormData({
        name: ticket.name,
        type: ticket.type,
        price: ticket.price,
        quantity: ticket.quantity,
        available: ticket.available,
        description: ticket.description || "",
      });
    }
  }, [ticket]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === "price" || name === "quantity" || name === "available" 
        ? parseFloat(value) || 0 
        : value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const submitData = {
        event_id: eventId,
        name: formData.name,
        type: formData.type,
        price: Number(formData.price),
        quantity: Number(formData.quantity),
        available: Number(formData.available),
        description: formData.description || null,
      };

      

      if (ticket) {
        const { error } = await supabase
          .from("tickets")
          .update(submitData)
          .eq("id", ticket.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tickets")
          .insert(submitData);
        if (error) throw error;
      }

      onSubmit();
    } catch (error) {
      console.error("Bilet kaydedilemedi:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      
      let errorMessage = "Bilet kaydedilemedi. Lütfen tekrar deneyin.";
      
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = `Hata: ${error.message}`;
      } else if (typeof error === 'string') {
        errorMessage = `Hata: ${error}`;
      }
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h3 className="text-xl font-semibold text-slate-900">
            {ticket ? "Bilet Türünü Düzenle" : "Yeni Bilet Türü Ekle"}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Bilet Adı *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Örn: Standart Bilet"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Bilet Türü *
            </label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              {Object.entries(TICKET_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Fiyat (€) *
            </label>
            <input
              type="number"
              name="price"
              value={formData.price}
              onChange={handleChange}
              required
              min="0"
              step="0.01"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="0.00"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Toplam Adet *
              </label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                required
                min="1"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Mevcut Adet *
              </label>
              <input
                type="number"
                name="available"
                value={formData.available}
                onChange={handleChange}
                required
                min="0"
                max={formData.quantity}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Açıklama
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Bilete özel haklar veya açıklamalar..."
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                "Kaydediliyor..."
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {ticket ? "Güncelle" : "Ekle"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
