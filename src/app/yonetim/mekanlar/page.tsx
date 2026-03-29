"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Edit2, Trash2, MapPin, ChevronDown, ChevronUp, X, LayoutGrid } from "lucide-react";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { supabase } from "@/lib/supabase-client";
import OrganizerOrAdminGuard from "@/components/OrganizerOrAdminGuard";
import AdminImageUpload from "@/components/AdminImageUpload";
import RichTextEditor from "@/components/RichTextEditor";
import { getAccessTokenForApi } from "@/lib/supabase-auth-token";

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
  image_url_3: string | null;
  image_url_4: string | null;
  image_url_5: string | null;
  entrance_info: string | null;
  transport_info: string | null;
  map_embed_url: string | null;
  rules: string | null;
  faq: VenueFaqItem[];
  created_at: string;
  name_tr?: string | null;
  name_de?: string | null;
  name_en?: string | null;
  address_tr?: string | null;
  address_de?: string | null;
  address_en?: string | null;
  city_tr?: string | null;
  city_de?: string | null;
  city_en?: string | null;
  seating_layout_description_tr?: string | null;
  seating_layout_description_de?: string | null;
  seating_layout_description_en?: string | null;
  entrance_info_tr?: string | null;
  entrance_info_de?: string | null;
  entrance_info_en?: string | null;
  transport_info_tr?: string | null;
  transport_info_de?: string | null;
  transport_info_en?: string | null;
  rules_tr?: string | null;
  rules_de?: string | null;
  rules_en?: string | null;
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
  image_url_3: "",
  image_url_4: "",
  image_url_5: "",
  entrance_info: "",
  transport_info: "",
  map_embed_url: "",
  rules: "",
  faq: [] as VenueFaqItem[],
  name_tr: "",
  name_de: "",
  name_en: "",
  address_tr: "",
  address_de: "",
  address_en: "",
  city_tr: "",
  city_de: "",
  city_en: "",
  seating_layout_description_tr: "",
  seating_layout_description_de: "",
  seating_layout_description_en: "",
  entrance_info_tr: "",
  entrance_info_de: "",
  entrance_info_en: "",
  transport_info_tr: "",
  transport_info_de: "",
  transport_info_en: "",
  rules_tr: "",
  rules_de: "",
  rules_en: "",
};

const MAX_VENUE_GALLERY_IMAGES = 4;

type VenueFormState = typeof EMPTY_VENUE & {
  seating_layout_image_url?: string;
  image_url_1?: string;
  image_url_2?: string;
  image_url_3?: string;
  image_url_4?: string;
  image_url_5?: string;
};

type LibraryImage = { url: string; path: string; name: string };

function getGalleryFromForm(form: VenueFormState): string[] {
  return [form.image_url_2, form.image_url_3, form.image_url_4, form.image_url_5]
    .map((x) => (x || "").trim())
    .filter((x) => x.length > 0);
}

function applyGalleryToForm(prev: VenueFormState, gallery: string[]): VenueFormState {
  const next = gallery.slice(0, MAX_VENUE_GALLERY_IMAGES);
  return {
    ...prev,
    image_url_2: next[0] || "",
    image_url_3: next[1] || "",
    image_url_4: next[2] || "",
    image_url_5: next[3] || "",
  };
}

export default function MekanlarPage() {
  return (
    <OrganizerOrAdminGuard>
      <MekanlarContent />
    </OrganizerOrAdminGuard>
  );
}

function MekanlarContent() {
  const { isAdmin, isOrganizer } = useSimpleAuth();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [form, setForm] = useState<VenueFormState>({
    ...EMPTY_VENUE,
    seating_layout_image_url: "",
    image_url_1: "",
    image_url_2: "",
    image_url_3: "",
    image_url_4: "",
    image_url_5: "",
  });
  const [imageUploading, setImageUploading] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryImages, setLibraryImages] = useState<LibraryImage[]>([]);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const coverImage = (form.image_url_1 || "").trim();
  const galleryImages = getGalleryFromForm(form);
  const formPreviewImages = [coverImage, ...galleryImages, form.seating_layout_image_url]
    .map((x) => (x || "").trim())
    .filter((x) => x.length > 0);

  useEffect(() => {
    if (!isAdmin) return;
    fetchVenues();
  }, [isAdmin]);

  useEffect(() => {
    if (!showForm || !isAdmin) return;
    void fetchLibraryImages();
  }, [showForm, isAdmin]);

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
      image_url_3: (row.image_url_3 as string) || null,
      image_url_4: (row.image_url_4 as string) || null,
      image_url_5: (row.image_url_5 as string) || null,
      entrance_info: (row.entrance_info as string) || null,
      transport_info: (row.transport_info as string) || null,
      map_embed_url: (row.map_embed_url as string) || null,
      rules: (row.rules as string) || null,
      faq: faqArr,
      created_at: (row.created_at as string) || "",
      name_tr: (row.name_tr as string) || null,
      name_de: (row.name_de as string) || null,
      name_en: (row.name_en as string) || null,
      address_tr: (row.address_tr as string) || null,
      address_de: (row.address_de as string) || null,
      address_en: (row.address_en as string) || null,
      city_tr: (row.city_tr as string) || null,
      city_de: (row.city_de as string) || null,
      city_en: (row.city_en as string) || null,
      seating_layout_description_tr: (row.seating_layout_description_tr as string) || null,
      seating_layout_description_de: (row.seating_layout_description_de as string) || null,
      seating_layout_description_en: (row.seating_layout_description_en as string) || null,
      entrance_info_tr: (row.entrance_info_tr as string) || null,
      entrance_info_de: (row.entrance_info_de as string) || null,
      entrance_info_en: (row.entrance_info_en as string) || null,
      transport_info_tr: (row.transport_info_tr as string) || null,
      transport_info_de: (row.transport_info_de as string) || null,
      transport_info_en: (row.transport_info_en as string) || null,
      rules_tr: (row.rules_tr as string) || null,
      rules_de: (row.rules_de as string) || null,
      rules_en: (row.rules_en as string) || null,
    };
  }

  function resetForm() {
    setForm({
      ...EMPTY_VENUE,
      seating_layout_image_url: "",
      image_url_1: "",
      image_url_2: "",
      image_url_3: "",
      image_url_4: "",
      image_url_5: "",
    });
    setEditingVenue(null);
    setShowForm(false);
    setLibraryQuery("");
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
      image_url_3: venue.image_url_3 || "",
      image_url_4: venue.image_url_4 || "",
      image_url_5: venue.image_url_5 || "",
      entrance_info: venue.entrance_info || "",
      transport_info: venue.transport_info || "",
      map_embed_url: venue.map_embed_url || "",
      rules: venue.rules || "",
      faq: venue.faq.length > 0 ? [...venue.faq] : [{ soru: "", cevap: "" }],
      name_tr: venue.name_tr || venue.name || "",
      name_de: venue.name_de || "",
      name_en: venue.name_en || "",
      address_tr: venue.address_tr || venue.address || "",
      address_de: venue.address_de || "",
      address_en: venue.address_en || "",
      city_tr: venue.city_tr || venue.city || "",
      city_de: venue.city_de || "",
      city_en: venue.city_en || "",
      seating_layout_description_tr: venue.seating_layout_description_tr || venue.seating_layout_description || "",
      seating_layout_description_de: venue.seating_layout_description_de || "",
      seating_layout_description_en: venue.seating_layout_description_en || "",
      entrance_info_tr: venue.entrance_info_tr || venue.entrance_info || "",
      entrance_info_de: venue.entrance_info_de || "",
      entrance_info_en: venue.entrance_info_en || "",
      transport_info_tr: venue.transport_info_tr || venue.transport_info || "",
      transport_info_de: venue.transport_info_de || "",
      transport_info_en: venue.transport_info_en || "",
      rules_tr: venue.rules_tr || venue.rules || "",
      rules_de: venue.rules_de || "",
      rules_en: venue.rules_en || "",
    });
    setLibraryQuery("");
    setShowForm(true);
  }

  function startAdd() {
    setEditingVenue(null);
    setForm({
      ...EMPTY_VENUE,
      seating_layout_image_url: "",
      image_url_1: "",
      image_url_2: "",
      image_url_3: "",
      image_url_4: "",
      image_url_5: "",
      faq: [{ soru: "", cevap: "" }],
    });
    setLibraryQuery("");
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

  async function fetchLibraryImages() {
    setLibraryLoading(true);
    try {
      const token = await getAccessTokenForApi();
      if (!token) {
        setLibraryImages([]);
        return;
      }
      const res = await fetch("/api/list-images?folder=images&limit=50", {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Görsel listesi alınamadı");
      const data = (await res.json()) as { images?: LibraryImage[] };
      setLibraryImages(Array.isArray(data.images) ? data.images : []);
    } catch (err) {
      console.error("Görsel kütüphanesi alınamadı:", err);
      setLibraryImages([]);
    } finally {
      setLibraryLoading(false);
    }
  }

  function addGalleryImage(url: string) {
    const clean = url.trim();
    if (!clean) return;
    setForm((prev) => {
      const current = getGalleryFromForm(prev);
      if (current.includes(clean)) return prev;
      if (current.length >= MAX_VENUE_GALLERY_IMAGES) {
        alert(`Galeri en fazla ${MAX_VENUE_GALLERY_IMAGES} görsel alır.`);
        return prev;
      }
      return applyGalleryToForm(prev, [...current, clean]);
    });
  }

  function removeGalleryImage(index: number) {
    setForm((prev) => {
      const current = getGalleryFromForm(prev);
      return applyGalleryToForm(
        prev,
        current.filter((_, i) => i !== index)
      );
    });
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

      const nameVal = form.name_tr?.trim() || form.name.trim();
      const payload = {
        name: nameVal || form.name.trim(),
        address: form.address_tr?.trim() || form.address.trim() || null,
        city: form.city_tr?.trim() || form.city.trim() || null,
        capacity: form.capacity != null && form.capacity > 0 ? form.capacity : null,
        seating_layout_description: form.seating_layout_description_tr?.trim() || form.seating_layout_description.trim() || null,
        seating_layout_image_url: form.seating_layout_image_url?.trim() || null,
        image_url_1: form.image_url_1?.trim() || null,
        image_url_2: form.image_url_2?.trim() || null,
        image_url_3: form.image_url_3?.trim() || null,
        image_url_4: form.image_url_4?.trim() || null,
        image_url_5: form.image_url_5?.trim() || null,
        entrance_info: form.entrance_info_tr?.trim() || form.entrance_info.trim() || null,
        transport_info: form.transport_info_tr?.trim() || form.transport_info.trim() || null,
        map_embed_url: form.map_embed_url?.trim() || null,
        rules: form.rules_tr?.trim() || form.rules.trim() || null,
        faq: faqFiltered,
        name_tr: form.name_tr?.trim() || null,
        name_de: form.name_de?.trim() || null,
        name_en: form.name_en?.trim() || null,
        address_tr: form.address_tr?.trim() || null,
        address_de: form.address_de?.trim() || null,
        address_en: form.address_en?.trim() || null,
        city_tr: form.city_tr?.trim() || null,
        city_de: form.city_de?.trim() || null,
        city_en: form.city_en?.trim() || null,
        seating_layout_description_tr: form.seating_layout_description_tr?.trim() || null,
        seating_layout_description_de: form.seating_layout_description_de?.trim() || null,
        seating_layout_description_en: form.seating_layout_description_en?.trim() || null,
        entrance_info_tr: form.entrance_info_tr?.trim() || null,
        entrance_info_de: form.entrance_info_de?.trim() || null,
        entrance_info_en: form.entrance_info_en?.trim() || null,
        transport_info_tr: form.transport_info_tr?.trim() || null,
        transport_info_de: form.transport_info_de?.trim() || null,
        transport_info_en: form.transport_info_en?.trim() || null,
        rules_tr: form.rules_tr?.trim() || null,
        rules_de: form.rules_de?.trim() || null,
        rules_en: form.rules_en?.trim() || null,
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
      const { data: usedByEvents } = await supabase
        .from("events")
        .select("id")
        .eq("venue_id", id)
        .limit(1);
      if (usedByEvents && usedByEvents.length > 0) {
        alert("Bu mekan en az bir etkinlikte kullanıldığı için kaldırılamaz. Kayıtlı mekanlar etkinlik bitiminde de listede kalır.");
        return;
      }
      const { error } = await supabase.from("venues").delete().eq("id", id);
      if (error) throw error;
      setVenues((prev) => prev.filter((v) => v.id !== id));
      alert("Mekan silindi!");
    } catch (error) {
      console.error("Mekan silinemedi:", error);
      alert("İşlem başarısız: " + (error instanceof Error ? error.message : "Bilinmeyen hata"));
    }
  }

  if (!isAdmin && !isOrganizer) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Erişim Reddedildi</h2>
          <p className="text-red-600">Bu sayfaya sadece yönetici veya organizatör erişebilir.</p>
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
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Mekan Yönetimi</h1>
            <p className="mt-1 text-sm text-slate-500">
              Salon tasarımı (bölüm/sıra/koltuk, Musensaal görseli) için her mekanın yanındaki <strong>Salonlar</strong> butonuna tıklayın.
              {" "}
              <Link href="/yonetim/mekanlar/musensaal-onizleme" className="text-primary-600 hover:text-primary-700 font-medium">
                Musensaal planı önizle
              </Link>
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={startAdd}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              <Plus className="h-4 w-4" />
              Yeni Mekan
            </button>
          )}
        </div>

        <Link
          href="/yonetim/mekanlar/musensaal-onizleme"
          className="flex items-center gap-4 rounded-xl border-2 border-primary-200 bg-primary-50/50 p-4 mb-6 hover:border-primary-300 hover:bg-primary-50 transition-colors"
        >
          <div className="w-12 h-12 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
            <LayoutGrid className="h-6 w-6 text-primary-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900">Musensaal salon planı</h3>
            <p className="text-sm text-slate-600">Koltuk planı önizleme — Parkett, Empore, Seitensempore. Tıklanabilir koltuklar.</p>
          </div>
          <span className="text-primary-600 font-medium text-sm">Planı görüntüle →</span>
        </Link>

        {showForm && (
          <div className="mt-8">
            <div className="bg-white rounded-xl max-w-2xl w-full p-6 relative">
              <button
                type="button"
                onClick={resetForm}
                className="absolute top-4 right-4 p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                aria-label="Kapat"
              >
                <X className="h-5 w-5" />
              </button>
              <h2 className="text-xl font-bold text-slate-900 mb-6 pr-10">
                {editingVenue ? "Mekan Düzenle" : "Yeni Mekan"}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="rounded-lg border border-slate-200 p-4 bg-slate-50/50">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Mekan Adı (TR zorunlu, DE/EN opsiyonel)</h3>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs text-slate-500 mb-0.5">Türkçe *</label>
                      <input
                        type="text"
                        required
                        value={form.name_tr || form.name}
                        onChange={(e) => setForm((p) => ({ ...p, name_tr: e.target.value, name: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-0.5">Almanca</label>
                      <input
                        type="text"
                        value={form.name_de}
                        onChange={(e) => setForm((p) => ({ ...p, name_de: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-0.5">İngilizce</label>
                      <input
                        type="text"
                        value={form.name_en}
                        onChange={(e) => setForm((p) => ({ ...p, name_en: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-4 bg-slate-50/50">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Adres & Şehir</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-0.5">Adres (TR)</label>
                      <input
                        type="text"
                        value={form.address_tr || form.address}
                        onChange={(e) => setForm((p) => ({ ...p, address_tr: e.target.value, address: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-0.5">Adres (DE)</label>
                      <input
                        type="text"
                        value={form.address_de}
                        onChange={(e) => setForm((p) => ({ ...p, address_de: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-0.5">Adres (EN)</label>
                      <input
                        type="text"
                        value={form.address_en}
                        onChange={(e) => setForm((p) => ({ ...p, address_en: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                    <div>
                      <label className="block text-xs text-slate-500 mb-0.5">Şehir (TR)</label>
                      <input
                        type="text"
                        value={form.city_tr || form.city}
                        onChange={(e) => setForm((p) => ({ ...p, city_tr: e.target.value, city: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-0.5">Şehir (DE)</label>
                      <input
                        type="text"
                        value={form.city_de}
                        onChange={(e) => setForm((p) => ({ ...p, city_de: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-0.5">Şehir (EN)</label>
                      <input
                        type="text"
                        value={form.city_en}
                        onChange={(e) => setForm((p) => ({ ...p, city_en: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
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
                    Oturma Düzeni Açıklaması (TR / DE / EN)
                  </label>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs text-slate-500">TR</span>
                      <textarea
                        rows={2}
                        placeholder="Örn: 3 kademe, orkestra + balkon"
                        value={form.seating_layout_description_tr || form.seating_layout_description}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, seating_layout_description_tr: e.target.value, seating_layout_description: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-0.5"
                      />
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">DE</span>
                      <textarea
                        rows={2}
                        value={form.seating_layout_description_de}
                        onChange={(e) => setForm((p) => ({ ...p, seating_layout_description_de: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-0.5"
                      />
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">EN</span>
                      <textarea
                        rows={2}
                        value={form.seating_layout_description_en}
                        onChange={(e) => setForm((p) => ({ ...p, seating_layout_description_en: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-0.5"
                      />
                    </div>
                  </div>
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

                {formPreviewImages.length > 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-slate-900">Önizleme</h4>
                      <span className="text-xs text-slate-500">{formPreviewImages.length} görsel</span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                      {formPreviewImages.slice(0, 5).map((url, i) => (
                        <div
                          key={`${url}-${i}`}
                          className="rounded-lg overflow-hidden border border-slate-200 bg-white"
                        >
                          <img src={url} alt={`Önizleme ${i + 1}`} className="h-16 w-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500">
                    Görsel seçildiğinde burada mini önizleme görünecek.
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Kapak Fotoğrafı
                  </label>
                  <AdminImageUpload
                    value={form.image_url_1 || ""}
                    onChange={(url) => setForm((p) => ({ ...p, image_url_1: url }))}
                    onUploadingChange={setImageUploading}
                  />
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-slate-900">
                      Galeri Ekle
                    </h4>
                    <span className="text-xs text-slate-500">
                      {galleryImages.length}/{MAX_VENUE_GALLERY_IMAGES}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {Array.from({ length: MAX_VENUE_GALLERY_IMAGES }).map((_, idx) => {
                      const current = galleryImages[idx] || "";
                      return (
                        <div key={`gallery-slot-${idx}`} className="rounded-lg border border-slate-200 bg-white p-2">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-medium text-slate-600">Galeri Görseli {idx + 1}</p>
                            {current ? (
                              <button
                                type="button"
                                onClick={() => removeGalleryImage(idx)}
                                className="text-xs text-red-600 hover:text-red-700"
                              >
                                Kaldır
                              </button>
                            ) : null}
                          </div>
                          <AdminImageUpload
                            value={current}
                            onChange={(url) =>
                              setForm((prev) => {
                                const next = [...getGalleryFromForm(prev)];
                                if ((url || "").trim()) {
                                  next[idx] = url.trim();
                                } else {
                                  next.splice(idx, 1);
                                }
                                return applyGalleryToForm(prev, next.filter((x) => x && x.trim().length > 0));
                              })
                            }
                            onUploadingChange={setImageUploading}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 border-t border-slate-200 pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Galeriden Seç
                      </h5>
                      <button
                        type="button"
                        onClick={() => void fetchLibraryImages()}
                        className="text-xs text-primary-600 hover:text-primary-700"
                      >
                        Yenile
                      </button>
                    </div>
                    <input
                      type="text"
                      value={libraryQuery}
                      onChange={(e) => setLibraryQuery(e.target.value)}
                      placeholder="Dosya adıyla ara..."
                      className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                    />
                    {libraryLoading ? (
                      <p className="text-xs text-slate-500">Kütüphane yükleniyor...</p>
                    ) : (
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-auto pr-1">
                        {libraryImages
                          .filter((img) =>
                            libraryQuery.trim()
                              ? img.name.toLowerCase().includes(libraryQuery.trim().toLowerCase())
                              : true
                          )
                          .map((img) => (
                            <button
                              type="button"
                              key={img.path}
                              onClick={() => addGalleryImage(img.url)}
                              className="group rounded-md border border-slate-200 bg-white p-1 hover:border-primary-400"
                              title={img.name}
                            >
                              <img src={img.url} alt={img.name} className="h-14 w-full rounded object-cover" />
                            </button>
                          ))}
                      </div>
                    )}
                    {!libraryLoading && libraryImages.length === 0 && (
                      <p className="text-xs text-slate-500">Kütüphanede görsel bulunamadı.</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Giriş Bilgileri (TR / DE / EN)
                  </label>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs text-slate-500">TR</span>
                      <textarea
                        rows={2}
                        placeholder="Giriş kapıları, nereden girilir"
                        value={form.entrance_info_tr || form.entrance_info}
                        onChange={(e) => setForm((p) => ({ ...p, entrance_info_tr: e.target.value, entrance_info: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-0.5"
                      />
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">DE</span>
                      <textarea
                        rows={2}
                        value={form.entrance_info_de}
                        onChange={(e) => setForm((p) => ({ ...p, entrance_info_de: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-0.5"
                      />
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">EN</span>
                      <textarea
                        rows={2}
                        value={form.entrance_info_en}
                        onChange={(e) => setForm((p) => ({ ...p, entrance_info_en: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-0.5"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Ulaşım Bilgisi (TR / DE / EN)
                  </label>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs text-slate-500">TR</span>
                      <RichTextEditor
                        value={form.transport_info_tr || form.transport_info || ""}
                        onChange={(v) => setForm((p) => ({ ...p, transport_info_tr: v, transport_info: v }))}
                        placeholder="Metro, otobüs, otopark bilgileri..."
                        minHeight="100px"
                      />
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">DE</span>
                      <RichTextEditor
                        value={form.transport_info_de || ""}
                        onChange={(v) => setForm((p) => ({ ...p, transport_info_de: v }))}
                        placeholder="Metro, Bus, Parkplatz..."
                        minHeight="100px"
                      />
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">EN</span>
                      <RichTextEditor
                        value={form.transport_info_en || ""}
                        onChange={(v) => setForm((p) => ({ ...p, transport_info_en: v }))}
                        placeholder="Metro, bus, parking..."
                        minHeight="100px"
                      />
                    </div>
                  </div>
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
                    Giriş Kuralları (TR / DE / EN)
                  </label>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs text-slate-500">TR</span>
                      <textarea
                        rows={2}
                        placeholder="Yaş sınırı, yasaklar vb."
                        value={form.rules_tr || form.rules}
                        onChange={(e) => setForm((p) => ({ ...p, rules_tr: e.target.value, rules: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-0.5"
                      />
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">DE</span>
                      <textarea
                        rows={2}
                        value={form.rules_de}
                        onChange={(e) => setForm((p) => ({ ...p, rules_de: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-0.5"
                      />
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">EN</span>
                      <textarea
                        rows={2}
                        value={form.rules_en}
                        onChange={(e) => setForm((p) => ({ ...p, rules_en: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-0.5"
                      />
                    </div>
                  </div>
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
            {venues.map((venue) => {
              const cover = (venue.image_url_1 || "").trim();
              const venueThumbs = [venue.image_url_2, venue.image_url_3, venue.image_url_4, venue.image_url_5]
                .map((x) => (x || "").trim())
                .filter((x): x is string => x.length > 0);

              const thumbsToShow = venueThumbs.slice(0, 3);
              const gridCols =
                thumbsToShow.length === 1
                  ? "grid-cols-1"
                  : thumbsToShow.length === 2
                    ? "grid-cols-2"
                    : "grid-cols-3";
              const extraCount = Math.max(0, venueThumbs.length - thumbsToShow.length);

              return (
                <div
                  key={venue.id}
                  className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex gap-6">
                    <div className="w-24 h-24 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden">
                      {cover ? (
                        <img src={cover} alt={`${venue.name} kapak`} className="h-full w-full object-cover" />
                      ) : thumbsToShow.length > 0 ? (
                        <div className={`h-full grid ${gridCols} gap-1 bg-slate-100`}>
                          {thumbsToShow.map((url, idx) => (
                            <div key={`${url}-${idx}`} className="relative">
                              <img
                                src={url}
                                alt={venue.name}
                                className="h-full w-full object-cover"
                              />
                              {idx === 2 && extraCount > 0 && (
                                <div className="absolute inset-0 bg-black/55 flex items-center justify-center text-white text-xs font-semibold">
                                  +{extraCount}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <MapPin className="h-8 w-8 text-slate-400" />
                        </div>
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
                        {venueThumbs.length > 0 && (
                          <p className="mt-1 text-xs text-slate-500">Galeri: {venueThumbs.length} görsel</p>
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
                      <div className="flex gap-2 flex-wrap">
                        <Link
                          href={`/yonetim/mekanlar/${venue.id}/oturum-plani`}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-primary-200 bg-primary-50/50 text-primary-700 hover:bg-primary-100 text-sm font-medium"
                          title="Salonları ve oturum planlarını yönetin (bir mekanda birden fazla salon tanımlanabilir)"
                        >
                          <LayoutGrid className="h-4 w-4" />
                          Salonlar
                        </Link>
                        {isAdmin && (
                          <>
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
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
