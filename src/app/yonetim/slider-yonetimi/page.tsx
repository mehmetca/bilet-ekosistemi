"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Edit2, Trash2, ExternalLink, Image as ImageIcon, MoveUp, MoveDown } from "lucide-react";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import AdminOnlyGuard from "@/components/AdminOnlyGuard";
import AdminImageUploadFixed from "@/components/AdminImageUploadFixed";
import { supabase } from "@/lib/supabase-client";

interface Advertisement {
  id: string;
  title: string;
  image_url: string;
  link_url: string;
  placement: string;
  is_active: boolean;
  sort_order: number;
  locale?: string | null;
  overlay_title?: string | null;
  overlay_day?: string | null;
  overlay_month_year?: string | null;
  created_at: string;
}

const LOCALE_LABELS: Record<string, string> = { tr: "Türkçe", de: "Deutsch", en: "English" };

export default function SliderYonetimiPage() {
  const searchParams = useSearchParams();
  const { isAdmin, loading: authLoading } = useSimpleAuth();
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  const [newAd, setNewAd] = useState({
    title: "",
    image_url: "",
    link_url: "",
    placement: "main_slider",
    is_active: true,
    locale: "tr" as "tr" | "de" | "en",
    overlay_title: "",
    overlay_day: "",
    overlay_month_year: "",
  });

  useEffect(() => {
    fetchAdvertisements();
  }, []);

  useEffect(() => {
    if (!authLoading && isAdmin) {
      fetchAdvertisements();
    }
  }, [authLoading, isAdmin]);

  useEffect(() => {
    if (searchParams.get("yeni") === "true") openNewAdForm();
  }, [searchParams]);

  async function getAuthorizedHeaders() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("Oturum gerekli. Lütfen tekrar giriş yapın.");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  async function fetchAdvertisements() {
    try {
      const headers = await getAuthorizedHeaders().catch(() => null);
      const response = await fetch("/api/advertisements", {
        headers: headers || undefined,
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Slider öğeleri yüklenemedi");
      const data = await response.json();
      setAdvertisements(data || []);
    } catch (error) {
      console.error("Fetch advertisements error:", error);
    } finally {
      setLoading(false);
    }
  }

  function openNewAdForm() {
    setEditingAd(null);
    setNewAd({
      title: "",
      image_url: "",
      link_url: "",
      placement: "main_slider",
      is_active: true,
      locale: "tr",
      overlay_title: "",
      overlay_day: "",
      overlay_month_year: "",
    });
    setShowAddForm(true);
  }

  async function handleAddAd() {
    try {
      if (!newAd.title.trim()) {
        alert("Başlık boş olamaz.");
        return;
      }
      if (!newAd.image_url.trim()) {
        alert("Görsel boş olamaz.");
        return;
      }

      const headers = await getAuthorizedHeaders();
      const response = await fetch("/api/advertisements", {
        method: "POST",
        headers,
        body: JSON.stringify({ ...newAd, placement: "main_slider" }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || "Slider kartı eklenemedi");
      }

      alert("Slider kartı eklendi.");
      setNewAd({
        title: "",
        image_url: "",
        link_url: "",
        placement: "main_slider",
        is_active: true,
        locale: "tr",
        overlay_title: "",
        overlay_day: "",
        overlay_month_year: "",
      });
      setShowAddForm(false);
      fetchAdvertisements();
    } catch (error) {
      console.error("Add advertisement error:", error);
      alert(error instanceof Error ? error.message : "Slider kartı eklenemedi.");
    }
  }

  async function handleUpdateAd() {
    if (!editingAd) return;

    try {
      if (!newAd.title.trim()) {
        alert("Başlık boş olamaz.");
        return;
      }
      if (!newAd.image_url.trim()) {
        alert("Görsel boş olamaz.");
        return;
      }

      const headers = await getAuthorizedHeaders();
      const response = await fetch(`/api/advertisements/${editingAd.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ ...newAd, placement: "main_slider" }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || "Güncelleme başarısız");
      }

      alert("Slider kartı güncellendi.");
      setEditingAd(null);
      setNewAd({
        title: "",
        image_url: "",
        link_url: "",
        placement: "main_slider",
        is_active: true,
        locale: "tr",
        overlay_title: "",
        overlay_day: "",
        overlay_month_year: "",
      });
      setShowAddForm(false);
      fetchAdvertisements();
    } catch (error) {
      console.error("Update advertisement error:", error);
      alert(error instanceof Error ? error.message : "Güncelleme başarısız.");
    }
  }

  async function handleDeleteAd(adId: string) {
    if (!confirm("Bu slider kartını silmek istediğinize emin misiniz?")) {
      return;
    }

    try {
      const headers = await getAuthorizedHeaders();
      const response = await fetch(`/api/advertisements/${adId}`, {
        method: "DELETE",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || "Silinemedi");
      }

      alert("Slider kartı silindi.");
      fetchAdvertisements();
    } catch (error) {
      console.error("Delete advertisement error:", error);
      alert(error instanceof Error ? error.message : "Silinemedi.");
    }
  }

  /** Ana slider panelindeki gibi: komşuyla yer değiştir, sıralama numarası yeniden yazılır. */
  async function handleMoveOrder(adId: string, direction: "up" | "down") {
    if (movingId) return;
    const index = advertisements.findIndex((ad) => ad.id === adId);
    const target = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= advertisements.length) return;

    const next = [...advertisements];
    [next[index], next[target]] = [next[target], next[index]];
    const changed = next
      .map((ad, i) => ({ id: ad.id, sort_order: i, stored: ad.sort_order }))
      .filter((row) => row.stored !== row.sort_order);
    if (changed.length === 0) return;

    setMovingId(adId);
    try {
      const headers = await getAuthorizedHeaders();
      for (const row of changed) {
        const response = await fetch(`/api/advertisements/${row.id}`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ sort_order: row.sort_order }),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData?.error || "Sıra güncellenemedi");
        }
      }
      fetchAdvertisements();
    } catch (error) {
      console.error("Reorder advertisement error:", error);
      alert(error instanceof Error ? error.message : "Sıra güncellenemedi.");
    } finally {
      setMovingId(null);
    }
  }

  function startEditAd(ad: Advertisement) {
    setEditingAd(ad);
    setNewAd({
      title: ad.title,
      image_url: ad.image_url,
      link_url: ad.link_url,
      placement: ad.placement,
      is_active: ad.is_active,
      locale: (ad.locale || "tr") as "tr" | "de" | "en",
      overlay_title: ad.overlay_title || "",
      overlay_day: ad.overlay_day || "",
      overlay_month_year: ad.overlay_month_year || "",
    });
    setShowAddForm(true);
  }

  function cancelEdit() {
    setEditingAd(null);
    setShowAddForm(false);
    setNewAd({
      title: "",
      image_url: "",
      link_url: "",
      placement: "main_slider",
      is_active: true,
      locale: "tr",
      overlay_title: "",
      overlay_day: "",
      overlay_month_year: "",
    });
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <AdminOnlyGuard>
      <div className="min-h-screen bg-paper">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-slate-900">Slider yönetimi</h1>
            <button
              onClick={openNewAdForm}
              className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              <Plus className="h-4 w-4" />
              Yeni slider kartı
            </button>
          </div>

          {showAddForm && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
              <h2 className="text-xl font-bold text-slate-900 mb-6">
                {editingAd ? "Slider kartını düzenle" : "Yeni slider kartı"}
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Başlık</label>
                  <input
                    type="text"
                    placeholder="Kart başlığı"
                    value={newAd.title}
                    onChange={(e) => setNewAd({ ...newAd, title: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tıklanınca gidecek link</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={newAd.link_url}
                    onChange={(e) => setNewAd({ ...newAd, link_url: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dil (hedef kitle)</label>
                  <select
                    value={newAd.locale}
                    onChange={(e) => setNewAd({ ...newAd, locale: e.target.value as "tr" | "de" | "en" })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    <option value="tr">Türkçe</option>
                    <option value="de">Deutsch (Almanca)</option>
                    <option value="en">English (İngilizce)</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={newAd.is_active}
                    onChange={(e) => setNewAd({ ...newAd, is_active: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  <label htmlFor="is_active" className="text-sm font-medium text-slate-700">
                    Yayında (aktif)
                  </label>
                </div>
                <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  Üst yazı ve tarih alanları isteğe bağlıdır. Boş bırakırsanız slider yalnızca görsel olarak yayınlanır.
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Slider üst yazı başlığı <span className="font-normal text-slate-400">(opsiyonel)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Örn. HARIKA"
                    value={newAd.overlay_title}
                    onChange={(e) => setNewAd({ ...newAd, overlay_title: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Tarih — gün <span className="font-normal text-slate-400">(opsiyonel)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Örn. 05"
                    value={newAd.overlay_day}
                    onChange={(e) => setNewAd({ ...newAd, overlay_day: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Tarih — ay / yıl <span className="font-normal text-slate-400">(opsiyonel)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Örn. Mayıs 2026"
                    value={newAd.overlay_month_year}
                    onChange={(e) => setNewAd({ ...newAd, overlay_month_year: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="mt-4">
                <AdminImageUploadFixed
                  value={newAd.image_url}
                  onChange={(url) => setNewAd({ ...newAd, image_url: url })}
                  folder="advertisements"
                  previewClassName="mx-auto block h-auto max-h-[400px] w-auto max-w-full rounded-lg object-contain"
                />
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={editingAd ? handleUpdateAd : handleAddAd}
                  className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium"
                >
                  {editingAd ? "Güncelle" : "Kaydet"}
                </button>
                <button
                  onClick={cancelEdit}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium"
                >
                  İptal
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Slider kartları</h2>
            {advertisements.length === 0 ? (
              <div className="text-center py-8">
                <ImageIcon className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500 mb-4">Henüz slider kartı yok.</p>
                <button
                  onClick={openNewAdForm}
                  className="text-primary-600 hover:text-primary-700 underline"
                >
                  İlk kartı ekle
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {advertisements.map((ad, index) => (
                  <div key={ad.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-xs font-semibold text-slate-500 tabular-nums">
                            {index + 1}. sıra
                          </span>
                          <h3 className="font-semibold text-slate-900">{ad.title}</h3>
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              ad.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                            }`}
                          >
                            {ad.is_active ? "Aktif" : "Pasif"}
                          </span>
                          {ad.locale && (
                            <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700">
                              {LOCALE_LABELS[ad.locale] || ad.locale.toUpperCase()}
                            </span>
                          )}
                        </div>

                        {ad.image_url && (
                          <img
                            src={ad.image_url}
                            alt={ad.title}
                            className="w-full h-32 object-cover rounded-lg mb-3"
                          />
                        )}

                        <div className="space-y-2 text-sm">
                          <div className="flex items-center text-slate-600">
                            <span className="font-medium">Link:</span>
                            <a
                              href={ad.link_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary-600 hover:text-primary-700 ml-1 flex items-center gap-1"
                            >
                              {ad.link_url}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                          <div className="flex items-center text-slate-600">
                            <span className="font-medium">Yerleşim:</span>
                            <span className="ml-1">Ana slider</span>
                          </div>
                          {(ad.overlay_title || ad.overlay_day || ad.overlay_month_year) && (
                            <div className="text-slate-600">
                              <span className="font-medium">Üst yazı:</span>
                              <span className="ml-1">{ad.overlay_title || "-"}</span>
                              <span className="mx-2">|</span>
                              <span>{ad.overlay_day || "-"}</span>
                              <span className="mx-1">{ad.overlay_month_year || "-"}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => void handleMoveOrder(ad.id, "up")}
                          disabled={index === 0 || movingId !== null}
                          className="text-slate-600 hover:text-slate-900 p-2 rounded hover:bg-slate-100 disabled:opacity-40"
                          title="Yukari tasi"
                        >
                          <MoveUp className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => void handleMoveOrder(ad.id, "down")}
                          disabled={index === advertisements.length - 1 || movingId !== null}
                          className="text-slate-600 hover:text-slate-900 p-2 rounded hover:bg-slate-100 disabled:opacity-40"
                          title="Asagi tasi"
                        >
                          <MoveDown className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => startEditAd(ad)}
                          className="text-blue-600 hover:text-blue-900 p-2 rounded hover:bg-blue-50"
                          title="Düzenle"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteAd(ad.id)}
                          className="text-red-600 hover:text-red-900 p-2 rounded hover:bg-red-50"
                          title="Sil"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminOnlyGuard>
  );
}
