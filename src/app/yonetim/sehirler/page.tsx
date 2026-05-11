"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, MapPin, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/lib/supabase-client";
import AdminOnlyGuard from "@/components/AdminOnlyGuard";
import AdminImageUploadFixed from "@/components/AdminImageUploadFixed";
import RichTextEditor from "@/components/RichTextEditor";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";

interface City {
  id: string;
  slug: string;
  name_tr: string | null;
  name_de: string | null;
  name_en: string | null;
  name_ku: string | null;
  name_ckb: string | null;
  description_tr: string | null;
  description_de: string | null;
  description_en: string | null;
  description_ku: string | null;
  description_ckb: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

const EMPTY_CITY = {
  slug: "",
  name_tr: "",
  name_de: "",
  name_en: "",
  name_ku: "",
  name_ckb: "",
  description_tr: "",
  description_de: "",
  description_en: "",
  description_ku: "",
  description_ckb: "",
  image_url: "",
  sort_order: 0,
  is_active: true,
};

export default function SehirlerPage() {
  return (
    <AdminOnlyGuard>
      <SehirlerContent />
    </AdminOnlyGuard>
  );
}

function SehirlerContent() {
  const { isAdmin } = useSimpleAuth();
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingCity, setEditingCity] = useState<City | null>(null);
  const [form, setForm] = useState(EMPTY_CITY);

  useEffect(() => {
    if (!isAdmin) return;
    fetchCities();
  }, [isAdmin]);

  async function fetchCities() {
    try {
      const { data, error } = await supabase
        .from("cities")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("slug", { ascending: true });

      if (error) throw error;
      setCities((data || []) as City[]);
    } catch (error) {
      console.error("Şehirler yüklenemedi:", error);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(city: City) {
    setEditingCity(city);
    setForm({
      slug: city.slug,
      name_tr: city.name_tr || "",
      name_de: city.name_de || "",
      name_en: city.name_en || "",
      name_ku: city.name_ku || "",
      name_ckb: city.name_ckb || "",
      description_tr: city.description_tr || "",
      description_de: city.description_de || "",
      description_en: city.description_en || "",
      description_ku: city.description_ku || "",
      description_ckb: city.description_ckb || "",
      image_url: city.image_url || "",
      sort_order: city.sort_order ?? 0,
      is_active: city.is_active ?? true,
    });
    setShowForm(true);
  }

  function startAdd() {
    setEditingCity(null);
    setForm(EMPTY_CITY);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.slug.trim()) {
      alert("Slug zorunludur (örn: hamburg, istanbul). Etkinliklerdeki location veya venue.city ile eşleşmeli.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        slug: form.slug.trim().toLowerCase().replace(/\s+/g, "-"),
        name_tr: form.name_tr?.trim() || null,
        name_de: form.name_de?.trim() || null,
        name_en: form.name_en?.trim() || null,
        name_ku: form.name_ku?.trim() || null,
        name_ckb: form.name_ckb?.trim() || null,
        description_tr: form.description_tr?.trim() || null,
        description_de: form.description_de?.trim() || null,
        description_en: form.description_en?.trim() || null,
        description_ku: form.description_ku?.trim() || null,
        description_ckb: form.description_ckb?.trim() || null,
        image_url: form.image_url?.trim() || null,
        sort_order: form.sort_order ?? 0,
        is_active: form.is_active ?? true,
      };

      if (editingCity) {
        const { error } = await supabase.from("cities").update(payload).eq("id", editingCity.id);
        if (error) throw error;
        alert("Şehir güncellendi!");
      } else {
        const { error } = await supabase.from("cities").insert(payload);
        if (error) throw error;
        alert("Şehir eklendi!");
      }

      await fetchCities();
      setShowForm(false);
      setEditingCity(null);
    } catch (error: unknown) {
      console.error("Şehir kaydedilemedi:", error);
      const msg = error && typeof error === "object" && "message" in error ? String((error as { message: string }).message) : "Bilinmeyen hata";
      alert("İşlem başarısız: " + msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu şehri silmek istediğinizden emin misiniz?")) return;
    try {
      const { error } = await supabase.from("cities").delete().eq("id", id);
      if (error) throw error;
      setCities((prev) => prev.filter((c) => c.id !== id));
      alert("Şehir silindi!");
    } catch (error) {
      console.error("Şehir silinemedi:", error);
      alert("İşlem başarısız: " + (error instanceof Error ? error.message : "Bilinmeyen hata"));
    }
  }

  if (!isAdmin) {
    return (
      <div className="p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <h2 className="mb-2 text-lg font-semibold text-red-800">Erişim Reddedildi</h2>
          <p className="text-red-600">Bu sayfaya sadece yöneticiler erişebilir.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Şehirler</h1>
            <p className="mt-1 text-slate-600">
              &quot;Das ist los in deiner Stadt!&quot; bölümü için şehir sayfaları. Slug, etkinliklerdeki location veya mekan city ile eşleşmeli (örn: hamburg, istanbul).
            </p>
          </div>
          <button
            type="button"
            onClick={startAdd}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 font-medium text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            Yeni Şehir
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-8 rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              {editingCity ? "Şehir Düzenle" : "Yeni Şehir Ekle"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Slug *</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                  placeholder="hamburg"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  required
                />
                <p className="mt-1 text-xs text-slate-500">
                  URL ve eşleştirme için. Etkinlik location veya venue.city ile eşleşmeli (küçük harf).
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Ad (TR)</label>
                  <input
                    type="text"
                    value={form.name_tr}
                    onChange={(e) => setForm((p) => ({ ...p, name_tr: e.target.value }))}
                    placeholder="İstanbul"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Ad (DE)</label>
                  <input
                    type="text"
                    value={form.name_de}
                    onChange={(e) => setForm((p) => ({ ...p, name_de: e.target.value }))}
                    placeholder="Hamburg"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Ad (EN)</label>
                  <input
                    type="text"
                    value={form.name_en}
                    onChange={(e) => setForm((p) => ({ ...p, name_en: e.target.value }))}
                    placeholder="Istanbul"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Nav (KU – Kurmancî)</label>
                  <input
                    type="text"
                    value={form.name_ku}
                    onChange={(e) => setForm((p) => ({ ...p, name_ku: e.target.value }))}
                    placeholder="Stenbol"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">ناو (CKB – Soranî)</label>
                  <input
                    type="text"
                    value={form.name_ckb}
                    onChange={(e) => setForm((p) => ({ ...p, name_ckb: e.target.value }))}
                    placeholder="ئەستەنبوڵ"
                    dir="rtl"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Hero Görsel (URL)</label>
                <AdminImageUploadFixed
                  value={form.image_url || ""}
                  onChange={(url) => setForm((p) => ({ ...p, image_url: url }))}
                  folder="hero-backgrounds"
                />
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700">Açıklama (5 dil)</h3>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">TR</label>
                  <RichTextEditor
                    value={form.description_tr}
                    onChange={(v) => setForm((p) => ({ ...p, description_tr: v }))}
                    placeholder="Şehir hakkında bilgi..."
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">DE</label>
                  <RichTextEditor
                    value={form.description_de}
                    onChange={(v) => setForm((p) => ({ ...p, description_de: v }))}
                    placeholder="Informationen über die Stadt..."
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">EN</label>
                  <RichTextEditor
                    value={form.description_en}
                    onChange={(v) => setForm((p) => ({ ...p, description_en: v }))}
                    placeholder="Information about the city..."
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">KU (Kurmancî)</label>
                  <RichTextEditor
                    value={form.description_ku}
                    onChange={(v) => setForm((p) => ({ ...p, description_ku: v }))}
                    placeholder="Agahî li ser bajêr..."
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">CKB (Soranî)</label>
                  <RichTextEditor
                    value={form.description_ckb}
                    onChange={(v) => setForm((p) => ({ ...p, description_ckb: v }))}
                    placeholder="زانیاری دەربارەی شار..."
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Sıra</label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => setForm((p) => ({ ...p, sort_order: parseInt(e.target.value, 10) || 0 }))}
                    className="w-24 rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm text-slate-700">Aktif</span>
                </label>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-primary-600 px-4 py-2 font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {submitting ? "Kaydediliyor..." : "Kaydet"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingCity(null); }}
                className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
              >
                İptal
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="text-slate-500">Yükleniyor...</div>
        ) : cities.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
            <MapPin className="mx-auto mb-4 h-16 w-16 text-slate-300" />
            <p className="text-slate-600">Henüz şehir eklenmemiş.</p>
            <button
              type="button"
              onClick={startAdd}
              className="mt-4 inline-flex items-center gap-2 text-primary-600 hover:text-primary-700"
            >
              <Plus className="h-4 w-4" />
              İlk şehri ekle
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {cities.map((city) => (
              <div
                key={city.id}
                className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4"
              >
                {city.image_url ? (
                  <img
                    src={city.image_url}
                    alt={city.name_tr || city.slug}
                    className="h-16 w-24 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-24 items-center justify-center rounded-lg bg-slate-100">
                    <ImageIcon className="h-8 w-8 text-slate-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900">{city.name_tr || city.name_de || city.name_en || city.slug}</div>
                  <div className="text-sm text-slate-500">/city/{city.slug}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(city)}
                    className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(city.id)}
                    className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

