"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { supabase } from "@/lib/supabase-client";
import AdminGuard from "@/components/AdminGuard";
import AdminImageUpload from "@/components/AdminImageUpload";
import RichTextEditor from "@/components/RichTextEditor";

interface VenueFaqItem {
  soru: string;
  cevap: string;
}

interface Venue {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  capacity: number | null;
  seating_layout_description: string | null;
  seating_layout_image_url: string | null;
  image_url_1: string | null;
  image_url_2: string | null;
  entrance_info: string | null;
  transport_info: string | null;
  map_embed_url: string | null;
  rules: string | null;
  faq: VenueFaqItem[];
  created_at: string;
}

const EMPTY_VENUE = {
  name: "",
  address: "",
  city: "",
  capacity: null as number | null,
  seating_layout_description: "",
  seating_layout_image_url: "",
  image_url_1: "",
  image_url_2: "",
  entrance_info: "",
  transport_info: "",
  map_embed_url: "",
  rules: "",
  faq: [] as VenueFaqItem[],
};

export default function MekanlarPage() {
  return (
    <AdminGuard>
      <MekanlarContent />
    </AdminGuard>
  );
}

function MekanlarContent() {
  const { isAdmin } = useSimpleAuth();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [form, setForm] = useState<
    typeof EMPTY_VENUE & { seating_layout_image_url?: string; image_url_1?: string; image_url_2?: string }
  >({
    ...EMPTY_VENUE,
    seating_layout_image_url: "",
    image_url_1: "",
    image_url_2: "",
  });
  const [imageUploading, setImageUploading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    fetchVenues();
  }, [isAdmin]);

  async function fetchVenues() {
    try {
      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      setVenues((data || []).map(normalizeVenue));
    } catch (error) {
      console.error("Mekanlar yüklenemedi:", error);
    } finally {
      setLoading(false);
    }
  }

  function normalizeVenue(row: Record<string, unknown>): Venue {
    const faq = row.faq;
    const faqArr = Array.isArray(faq)
      ? (faq as VenueFaqItem[]).filter((x) => x?.soru && x?.cevap)
      : [];
    return {
      id: row.id as string,
      name: (row.name as string) || "",
      address: (row.address as string) || null,
      city: (row.city as string) || null,
      capacity: row.capacity != null ? Number(row.capacity) : null,
      seating_layout_description: (row.seating_layout_description as string) || null,
      seating_layout_image_url: (row.seating_layout_image_url as string) || null,
      image_url_1: (row.image_url_1 as string) || null,
      image_url_2: (row.image_url_2 as string) || null,
      entrance_info: (row.entrance_info as string) || null,
      transport_info: (row.transport_info as string) || null,
      map_embed_url: (row.map_embed_url as string) || null,
      rules: (row.rules as string) || null,
      faq: faqArr,
      created_at: (row.created_at as string) || "",
    };
  }

  function resetForm() {
    setForm({ ...EMPTY_VENUE, seating_layout_image_url: "", image_url_1: "", image_url_2: "" });
    setEditingVenue(null);
    setShowForm(false);
  }

  function startEdit(venue: Venue) {
    setEditingVenue(venue);
    setForm({
      name: venue.name,
      address: venue.address || "",
      city: venue.city || "",
      capacity: venue.capacity,
      seating_layout_description: venue.seating_layout_description || "",
      seating_layout_image_url: venue.seating_layout_image_url || "",
      image_url_1: venue.image_url_1 || "",
      image_url_2: venue.image_url_2 || "",
      entrance_info: venue.entrance_info || "",
      transport_info: venue.transport_info || "",
      map_embed_url: venue.map_embed_url || "",
      rules: venue.rules || "",
      faq: venue.faq.length > 0 ? [...venue.faq] : [{ soru: "", cevap: "" }],
    });
    setShowForm(true);
  }

  function startAdd() {
    setEditingVenue(null);
    setForm({
      ...EMPTY_VENUE,
      seating_layout_image_url: "",
      image_url_1: "",
      image_url_2: "",
      faq: [{ soru: "", cevap: "" }],
    });
    setShowForm(true);
  }

  function addFaqRow() {
    setForm((prev) => ({
      ...prev,
      faq: [...prev.faq, { soru: "", cevap: "" }],
    }));
  }

  function updateFaqRow(index: number, field: "soru" | "cevap", value: string) {
    setForm((prev) => {
      const next = [...prev.faq];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, faq: next };
    });
  }

  function removeFaqRow(index: number) {
    setForm((prev) => ({
      ...prev,
      faq: prev.faq.filter((_, i) => i !== index),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (imageUploading) {
      alert("Görsel yükleniyor, lütfen tamamlanmasını bekleyin.");
      return;
    }

    setSubmitting(true);
    try {
      const faqFiltered = form.faq.filter((x) => x.soru.trim() && x.cevap.trim());

      const payload = {
        name: form.name.trim(),
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        capacity: form.capacity != null && form.capacity > 0 ? form.capacity : null,
        seating_layout_description: form.seating_layout_description.trim() || null,
        seating_layout_image_url: form.seating_layout_image_url?.trim() || null,
        image_url_1: form.image_url_1?.trim() || null,
        image_url_2: form.image_url_2?.trim() || null,
        entrance_info: form.entrance_info.trim() || null,
        transport_info: form.transport_info.trim() || null,
        map_embed_url: form.map_embed_url?.trim() || null,
        rules: form.rules.trim() || null,
        faq: faqFiltered,
      };

      if (editingVenue) {
        const { error } = await supabase
          .from("venues")
          .update(payload)
          .eq("id", editingVenue.id);

        if (error) throw error;
        alert("Mekan güncellendi!");
      } else {
        const { error } = await supabase.from("venues").insert(payload);
        if (error) throw error;
        alert("Mekan eklendi!");
      }

      await fetchVenues();
      resetForm();
    } catch (error: unknown) {
      console.error("Mekan kaydedilemedi:", error);
      const msg =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: string }).message)
          : error instanceof Error
            ? error.message
            : "Bilinmeyen hata";
      alert("İşlem başarısız: " + msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu mekanı silmek istediğinizden emin misiniz?")) return;

    try {
      const { error } = await supabase.from("venues").delete().eq("id", id);
      if (error) throw error;
      setVenues((prev) => prev.filter((v) => v.id !== id));
      alert("Mekan silindi!");
    } catch (error) {
      console.error("Mekan silinemedi:", error);
      alert("İşlem başarısız: " + (error instanceof Error ? error.message : "Bilinmeyen hata"));
    }
  }

  if (!isAdmin) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Erişim Reddedildi</h2>
          <p className="text-red-600">Bu sayfaya sadece yöneticiler erişebilir.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Mekan Yönetimi</h1>
          <button
            onClick={startAdd}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            Yeni Mekan
          </button>
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-6">
                {editingVenue ? "Mekan Düzenle" : "Yeni Mekan"}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mekan Adı *</label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Adres</label>
                    <input
                      type="text"
                      value={form.address}
                      onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Şehir</label>
                    <input
                      type="text"
                      value={form.city}
                      onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kapasite</label>
                  <input
                    type="number"
                    min="0"
                    value={form.capacity ?? ""}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        capacity: e.target.value === "" ? null : parseInt(e.target.value, 10) || 0,
                      }))
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Oturma Düzeni Açıklaması
                  </label>
                  <textarea
                    name="seating_layout_description"
                    rows={3}
                    placeholder="Örn: 3 kademe, orkestra + balkon, toplam 12 blok"
                    value={form.seating_layout_description}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, seating_layout_description: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Oturma Planı Görseli
                  </label>
                  <AdminImageUpload
                    value={form.seating_layout_image_url || ""}
                    onChange={(url) => setForm((p) => ({ ...p, seating_layout_image_url: url }))}
                    onUploadingChange={setImageUploading}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Mekan Fotoğrafı 1
                    </label>
                    <AdminImageUpload
                      value={form.image_url_1 || ""}
                      onChange={(url) => setForm((p) => ({ ...p, image_url_1: url }))}
                      onUploadingChange={setImageUploading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Mekan Fotoğrafı 2 (opsiyonel)
                    </label>
                    <AdminImageUpload
                      value={form.image_url_2 || ""}
                      onChange={(url) => setForm((p) => ({ ...p, image_url_2: url }))}
                      onUploadingChange={setImageUploading}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Giriş Bilgileri
                  </label>
                  <textarea
                    name="entrance_info"
                    rows={2}
                    placeholder="Giriş kapıları, nereden girilir"
                    value={form.entrance_info}
                    onChange={(e) => setForm((p) => ({ ...p, entrance_info: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Ulaşım Bilgisi
                  </label>
                  <RichTextEditor
                    value={form.transport_info || ""}
                    onChange={(v) => setForm((p) => ({ ...p, transport_info: v }))}
                    placeholder="Metro, otobüs, otopark bilgileri..."
                    minHeight="120px"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Google Harita
                  </label>
                  <textarea
                    name="map_embed_url"
                    rows={8}
                    placeholder="Google Maps'ten Paylaş > Haritayı yerleştir > HTML kopyala ile embed kodunu yapıştırın. veya sadece embed URL (https://www.google.com/maps/embed?pb=...)"
                    value={form.map_embed_url || ""}
                    onChange={(e) => setForm((p) => ({ ...p, map_embed_url: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500 font-mono text-sm"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Google Maps → Paylaş → Haritayı yerleştir → iframe kodunu kopyalayıp yapıştırın
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Giriş Kuralları
                  </label>
                  <textarea
                    name="rules"
                    rows={2}
                    placeholder="Yaş sınırı, yasaklar vb."
                    value={form.rules}
                    onChange={(e) => setForm((p) => ({ ...p, rules: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>

                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold text-slate-900">Sıkça Sorulan Sorular</h3>
                    <button
                      type="button"
                      onClick={addFaqRow}
                      className="text-sm text-primary-600 hover:text-primary-700"
                    >
                      + Soru Ekle
                    </button>
                  </div>
                  <div className="space-y-3">
                    {form.faq.map((item, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <div className="flex-1 space-y-2">
                          <input
                            type="text"
                            placeholder="Soru"
                            value={item.soru}
                            onChange={(e) => updateFaqRow(i, "soru", e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                          />
                          <input
                            type="text"
                            placeholder="Cevap"
                            value={item.cevap}
                            onChange={(e) => updateFaqRow(i, "cevap", e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFaqRow(i)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={submitting || imageUploading}
                    className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-60"
                  >
                    {submitting ? "Kaydediliyor..." : editingVenue ? "Güncelle" : "Ekle"}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={submitting}
                    className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                  >
                    İptal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {venues.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
            <MapPin className="h-16 w-16 mx-auto text-slate-300 mb-4" />
            <p className="text-lg font-medium">Henüz mekan eklenmemiş</p>
            <p className="mt-2 text-sm">İlk mekanı eklemek için "Yeni Mekan" butonuna tıklayın.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {venues.map((venue) => (
              <div
                key={venue.id}
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex gap-6">
                  <div className="w-24 h-24 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {(venue.image_url_1 || venue.seating_layout_image_url) ? (
                      <img
                        src={venue.image_url_1 || venue.seating_layout_image_url || ""}
                        alt={venue.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <MapPin className="h-8 w-8 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-slate-900">{venue.name}</h3>
                        <p className="mt-1 text-sm text-slate-600">
                          {venue.city && `${venue.city}`}
                          {venue.address && ` • ${venue.address}`}
                        </p>
                        {venue.capacity != null && (
                          <p className="mt-1 text-sm text-slate-500">
                            Kapasite: {venue.capacity} kişi
                          </p>
                        )}
                        {venue.seating_layout_description && (
                          <p className="mt-2 text-sm text-slate-600 line-clamp-2">
                            {venue.seating_layout_description}
                          </p>
                        )}
                        {venue.faq.length > 0 && (
                          <button
                            onClick={() =>
                              setExpandedId((id) => (id === venue.id ? null : venue.id))
                            }
                            className="mt-2 text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                          >
                            {expandedId === venue.id ? (
                              <>
                                <ChevronUp className="h-4 w-4" />
                                SSS'yi gizle
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-4 w-4" />
                                {venue.faq.length} SSS
                              </>
                            )}
                          </button>
                        )}
                        {expandedId === venue.id && venue.faq.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {venue.faq.map((item, i) => (
                              <div key={i} className="text-sm border-l-2 border-primary-200 pl-3">
                                <strong className="text-slate-700">{item.soru}</strong>
                                <p className="text-slate-600 mt-1">{item.cevap}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(venue)}
                          className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                          title="Düzenle"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(venue.id)}
                          className="p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                          title="Sil"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
