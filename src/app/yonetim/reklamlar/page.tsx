"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, ExternalLink, Image as ImageIcon } from "lucide-react";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import AdminOnlyGuard from "@/components/AdminOnlyGuard";
import AdminImageUploadFixed from "@/components/AdminImageUploadFixed";

interface Advertisement {
  id: string;
  title: string;
  image_url: string;
  link_url: string;
  placement: string;
  is_active: boolean;
  locale?: string | null;
  created_at: string;
}

const LOCALE_LABELS: Record<string, string> = { tr: "Türkçe", de: "Deutsch", en: "English" };

export default function ReklamlarPage() {
  const { isAdmin, loading: authLoading } = useSimpleAuth();
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null);

  const [newAd, setNewAd] = useState({
    title: "",
    image_url: "",
    link_url: "",
    placement: "news_slider",
    is_active: true,
    locale: "tr" as "tr" | "de" | "en"
  });

  useEffect(() => {
    fetchAdvertisements();
  }, []);

  async function fetchAdvertisements() {
    try {
      const response = await fetch("/api/advertisements");
      if (!response.ok) throw new Error("Reklamlar yuklenemedi");
      const data = await response.json();
      setAdvertisements(data || []);
    } catch (error) {
      console.error("Fetch advertisements error:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddAd() {
    try {
      const response = await fetch("/api/advertisements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAd),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || "Reklam eklenemedi");
      }

      alert("Reklam başarıyla eklendi!");
      setNewAd({
        title: "",
        image_url: "",
        link_url: "",
        placement: "news_slider",
        is_active: true,
        locale: "tr"
      });
      setShowAddForm(false);
      fetchAdvertisements();
    } catch (error) {
      console.error("Add advertisement error:", error);
      alert(error instanceof Error ? error.message : "Reklam eklenemedi!");
    }
  }

  async function handleUpdateAd() {
    if (!editingAd) return;

    try {
      const response = await fetch(`/api/advertisements/${editingAd.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAd),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || "Reklam guncellenemedi");
      }

      alert("Reklam başarıyla güncellendi!");
      setEditingAd(null);
      setNewAd({
        title: "",
        image_url: "",
        link_url: "",
        placement: "news_slider",
        is_active: true,
        locale: "tr"
      });
      setShowAddForm(false);
      fetchAdvertisements();
    } catch (error) {
      console.error("Update advertisement error:", error);
      alert(error instanceof Error ? error.message : "Reklam güncellenemedi!");
    }
  }

  async function handleDeleteAd(adId: string) {
    if (!confirm("Bu reklamı silmek istediğinizden emin misiniz?")) {
      return;
    }

    try {
      const response = await fetch(`/api/advertisements/${adId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || "Reklam silinemedi");
      }

      alert("Reklam başarıyla silindi!");
      fetchAdvertisements();
    } catch (error) {
      console.error("Delete advertisement error:", error);
      alert(error instanceof Error ? error.message : "Reklam silinemedi!");
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
      locale: (ad.locale || "tr") as "tr" | "de" | "en"
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
      placement: "news_slider",
      is_active: true,
      locale: "tr"
    });
  }

  // Yetki kontrolü
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <AdminOnlyGuard>
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Reklam Yönetimi</h1>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium"
          >
            <Plus className="h-4 w-4" />
            Yeni Reklam
          </button>
        </div>

        {/* Reklam Ekleme/Düzenleme Formu */}
        {showAddForm && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6">
              {editingAd ? "Reklam Düzenle" : "Yeni Reklam Ekle"}
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reklam Başlığı</label>
                <input
                  type="text"
                  placeholder="Reklam Başlığı"
                  value={newAd.title}
                  onChange={(e) => setNewAd({ ...newAd, title: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reklam Linki</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={newAd.link_url}
                  onChange={(e) => setNewAd({ ...newAd, link_url: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Dil (Hedef Kitle)</label>
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
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Yerleşim</label>
                <select
                  value={newAd.placement}
                  onChange={(e) => setNewAd({ ...newAd, placement: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="news_slider">Haberler Slider</option>
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
                  Reklam Aktif
                </label>
              </div>
            </div>
            <AdminImageUploadFixed
              value={newAd.image_url}
              onChange={(url) => setNewAd({ ...newAd, image_url: url })}
              folder="advertisements"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={editingAd ? handleUpdateAd : handleAddAd}
                className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium"
              >
                {editingAd ? "Güncelle" : "Reklam Ekle"}
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

        {/* Reklamlar Listesi */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Reklamlar</h2>
          {advertisements.length === 0 ? (
            <div className="text-center py-8">
              <ImageIcon className="h-16 w-16 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 mb-4">Henüz reklam eklenmemiş.</p>
              <button
                onClick={() => setShowAddForm(true)}
                className="text-primary-600 hover:text-primary-700 underline"
              >
                İlk Reklamı Ekle
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {advertisements.map((ad) => (
                <div key={ad.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="font-semibold text-slate-900">{ad.title}</h3>
                        <span className={`text-xs px-2 py-1 rounded ${
                          ad.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {ad.is_active ? 'Aktif' : 'Pasif'}
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
                          <span className="ml-1">
                            {ad.placement === 'news_slider' ? 'Haberler Slider' : ad.placement}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => startEditAd(ad)}
                        className="text-blue-600 hover:text-blue-900 p-2 rounded hover:bg-blue-50"
                        title="Reklamı Düzenle"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteAd(ad.id)}
                        className="text-red-600 hover:text-red-900 p-2 rounded hover:bg-red-50"
                        title="Reklamı Sil"
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
