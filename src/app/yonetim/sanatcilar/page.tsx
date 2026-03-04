"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import MDEditor from "@uiw/react-md-editor";
import AdminImageUploadFixed from "@/components/AdminImageUploadFixed";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { supabase } from "@/lib/supabase-client";
import {
  buildArtistBio,
  parseArtistBio,
  type ArtistGalleryPosition,
} from "@/lib/artistProfile";

type ArtistFormState = {
  id: string | null;
  name: string;
  slug: string;
  image_url: string;
  bio: string;
  name_tr: string;
  name_de: string;
  name_en: string;
  bio_tr: string;
  bio_de: string;
  bio_en: string;
  gallery_1: string;
  gallery_1_position: ArtistGalleryPosition;
  gallery_2: string;
  gallery_2_position: ArtistGalleryPosition;
  gallery_3: string;
  gallery_3_position: ArtistGalleryPosition;
  card_text: string;
  card_lines: number;
  video_1_url: string;
  video_2_url: string;
  video_3_url: string;
  youtube_url: string;
  spotify_url: string;
  instagram_url: string;
  website_url: string;
};

const EMPTY_FORM: ArtistFormState = {
  id: null,
  name: "",
  slug: "",
  image_url: "",
  bio: "",
  name_tr: "",
  name_de: "",
  name_en: "",
  bio_tr: "",
  bio_de: "",
  bio_en: "",
  gallery_1: "",
  gallery_1_position: "top",
  gallery_2: "",
  gallery_2_position: "top",
  gallery_3: "",
  gallery_3_position: "top",
  card_text: "",
  card_lines: 3,
  video_1_url: "",
  video_2_url: "",
  video_3_url: "",
  youtube_url: "",
  spotify_url: "",
  instagram_url: "",
  website_url: "",
};

const GALLERY_POSITION_OPTIONS: Array<{
  value: ArtistGalleryPosition;
  label: string;
}> = [
  { value: "top", label: "Yazının Üstünde" },
  { value: "bottom", label: "Yazının Altında" },
  { value: "left", label: "Yazının Solunda" },
  { value: "right", label: "Yazının Sağında" },
];

const CARD_LINE_OPTIONS = [1, 2, 3, 4, 5, 6];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function withTimeout<T>(
  requestFactory: (signal: AbortSignal) => PromiseLike<T>,
  timeoutMs = 0,
  controller?: AbortController
): Promise<T> {
  const scopedController = controller ?? new AbortController();
  if (timeoutMs <= 0) {
    return Promise.resolve(requestFactory(scopedController.signal));
  }
  const timeoutId = window.setTimeout(() => scopedController.abort(), timeoutMs);

  try {
    return await Promise.resolve(requestFactory(scopedController.signal));
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("İstek zaman aşımına uğradı.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export default function SanatcilarPage() {
  const { isAdmin, loading: authLoading } = useSimpleAuth();
  const [artists, setArtists] = useState<Array<{ id: string; name: string; slug: string; image_url?: string | null }>>([]);
  const [form, setForm] = useState<ArtistFormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingArtist, setLoadingArtist] = useState(false);
  const [query, setQuery] = useState("");
  const activeMutationIdRef = useRef(0);
  const activeMutationAbortRef = useRef<AbortController | null>(null);
  const isSaving = saving && activeMutationIdRef.current !== 0;
  const [toast, setToast] = useState<{ type: "success" | "warning" | "error"; message: string } | null>(
    null
  );

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    // Defensive reset: if a request path leaves saving locked, recover automatically.
    if (!isSaving) return;
    const timer = window.setTimeout(() => {
      activeMutationIdRef.current = 0;
      setSaving(false);
      setToast({
        type: "warning",
        message: "Kaydetme kilidi sıfırlandı. İşlemi tekrar deneyebilirsiniz.",
      });
    }, 45000);

    return () => window.clearTimeout(timer);
  }, [isSaving]);

  useEffect(() => {
    return () => {
      activeMutationAbortRef.current?.abort();
      activeMutationAbortRef.current = null;
      activeMutationIdRef.current = 0;
    };
  }, []);

  const filteredArtists = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return artists;
    return artists.filter(
      (artist) =>
        artist.name.toLowerCase().includes(term) ||
        artist.slug.toLowerCase().includes(term)
    );
  }, [artists, query]);

  async function loadArtists(options?: { quiet?: boolean }) {
    setLoading(true);
    try {
      const { data, error } = await withTimeout<{
        data: Array<{ id: string; name: string; slug: string; image_url?: string | null }> | null;
        error: { message: string } | null;
      }>(
        (signal) =>
          supabase
            .from("artists")
            .select("id,name,slug,image_url")
            .order("name", { ascending: true })
            .abortSignal(signal),
        30000
      );

      if (error) {
        if (!options?.quiet) {
          setToast({ type: "error", message: `Sanatçılar yüklenemedi: ${error.message}` });
        }
        return;
      }

      setArtists(data || []);
    } catch (error) {
      if (!options?.quiet) {
        setToast({ type: "error", message: `Sanatçılar yüklenemedi: ${(error as Error).message}` });
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadArtist(artistId: string) {
    setLoadingArtist(true);
    try {
      const { data, error } = await withTimeout<{
        data: Record<string, unknown> | null;
        error: { message: string } | null;
      }>(
        (signal) =>
          supabase
            .from("artists")
            .select("id,name,slug,bio,image_url,show_on_artist_page,show_on_tour_page,name_tr,name_de,name_en,bio_tr,bio_de,bio_en")
            .eq("id", artistId)
            .abortSignal(signal)
            .single(),
        30000
      );

      if (error || !data) {
        setToast({ type: "error", message: `Sanatçı yüklenemedi: ${error?.message || "Kayıt bulunamadı."}` });
        return;
      }

      const bioRaw = (data.bio_tr as string) || (data.bio as string);
      const parsed = parseArtistBio(bioRaw);
      const parsedDe = parseArtistBio((data.bio_de as string) || "");
      const parsedEn = parseArtistBio((data.bio_en as string) || "");
      const nameVal = (data.name_tr as string) || (data.name as string) || "";
      setForm({
        id: data.id as string,
        name: nameVal,
        slug: (data.slug as string) || "",
        image_url: (data.image_url as string) || "",
        bio: parsed.content || "",
        name_tr: (data.name_tr as string) || (data.name as string) || "",
        name_de: (data.name_de as string) || "",
        name_en: (data.name_en as string) || "",
        bio_tr: parsed.content || "",
        bio_de: parsedDe.content || "",
        bio_en: parsedEn.content || "",
        gallery_1: parsed.gallery[0]?.url || "",
        gallery_1_position: parsed.gallery[0]?.position || "top",
        gallery_2: parsed.gallery[1]?.url || "",
        gallery_2_position: parsed.gallery[1]?.position || "top",
        gallery_3: parsed.gallery[2]?.url || "",
        gallery_3_position: parsed.gallery[2]?.position || "top",
        card_text: parsed.cardText || "",
        card_lines: parsed.cardLines || 3,
        video_1_url: parsed.videoUrls[0] || "",
        video_2_url: parsed.videoUrls[1] || "",
        video_3_url: parsed.videoUrls[2] || "",
        youtube_url: parsed.socials.youtube || "",
        spotify_url: parsed.socials.spotify || "",
        instagram_url: parsed.socials.instagram || "",
        website_url: parsed.socials.website || "",
      });
    } catch (error) {
      setToast({ type: "error", message: `Sanatçı yüklenemedi: ${(error as Error).message}` });
    } finally {
      setLoadingArtist(false);
    }
  }

  function setFormField<K extends keyof ArtistFormState>(key: K, value: ArtistFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleNew() {
    setForm(EMPTY_FORM);
  }

  async function handleDelete() {
    if (!form.id) return;
    if (isSaving) {
      activeMutationAbortRef.current?.abort();
    }
    if (!confirm("Bu sanatçıyı silmek istiyor musunuz?")) return;

    const mutationAbortController = new AbortController();
    activeMutationAbortRef.current = mutationAbortController;
    const mutationId = Date.now();
    activeMutationIdRef.current = mutationId;
    setSaving(true);
    const watchdogId = window.setTimeout(() => {
      if (activeMutationIdRef.current !== mutationId) return;
      activeMutationIdRef.current = 0;
      setSaving(false);
      setToast({
        type: "warning",
        message: "Silme işlemi uzadı. Birkaç saniye sonra listeyi kontrol edin.",
      });
    }, 30000);

    try {
      const { error } = await withTimeout<{
        error: { message: string } | null;
      }>(
        (signal) => supabase.from("artists").delete().eq("id", form.id).abortSignal(signal),
        30000,
        mutationAbortController
      );

      if (error) {
        setToast({ type: "error", message: `Silme başarısız: ${error.message}` });
        return;
      }

      setArtists((prev) => prev.filter((artist) => artist.id !== form.id));
      void loadArtists({ quiet: true });
      setForm(EMPTY_FORM);
    } catch (error) {
      setToast({ type: "error", message: `Silme başarısız: ${(error as Error).message}` });
    } finally {
      clearTimeout(watchdogId);
      if (activeMutationIdRef.current === mutationId) {
        activeMutationIdRef.current = 0;
        activeMutationAbortRef.current = null;
        setSaving(false);
      }
    }
  }

  async function handleSave() {
    if (isSaving) {
      activeMutationAbortRef.current?.abort();
    }
    const nameVal = (form.name_tr || form.name).trim();
    if (!nameVal) {
      setToast({ type: "warning", message: "Sanatçı adı (TR) zorunlu." });
      return;
    }

    const slug = (form.slug || slugify(nameVal)).trim();
    if (!slug) {
      setToast({ type: "warning", message: "Slug oluşturulamadı." });
      return;
    }

    const gallery = [
      { url: form.gallery_1, position: form.gallery_1_position },
      { url: form.gallery_2, position: form.gallery_2_position },
      { url: form.gallery_3, position: form.gallery_3_position },
    ];
    const socials = {
      youtube: form.youtube_url,
      spotify: form.spotify_url,
      instagram: form.instagram_url,
      website: form.website_url,
    };
    const card = { text: form.card_text, lines: form.card_lines };
    const videos = { urls: [form.video_1_url, form.video_2_url, form.video_3_url] };

    const bioTr = buildArtistBio(form.bio_tr || form.bio, gallery, socials, card, videos);
    const bioDe = form.bio_de.trim()
      ? buildArtistBio(form.bio_de, gallery, socials, card, videos)
      : null;
    const bioEn = form.bio_en.trim()
      ? buildArtistBio(form.bio_en, gallery, socials, card, videos)
      : null;

    const payload = {
      name: nameVal,
      slug,
      image_url: form.image_url.trim() || null,
      bio: bioTr || null,
      name_tr: nameVal || null,
      name_de: form.name_de.trim() || null,
      name_en: form.name_en.trim() || null,
      bio_tr: bioTr || null,
      bio_de: bioDe,
      bio_en: bioEn,
    };

    const mutationAbortController = new AbortController();
    activeMutationAbortRef.current = mutationAbortController;
    const mutationId = Date.now();
    activeMutationIdRef.current = mutationId;
    setSaving(true);
    const watchdogId = window.setTimeout(() => {
      if (activeMutationIdRef.current !== mutationId) return;
      activeMutationIdRef.current = 0;
      setSaving(false);
      setToast({
        type: "warning",
        message: "Kaydetme işlemi uzadı. Birkaç saniye sonra listeyi kontrol edin.",
      });
    }, 30000);

    try {
      if (form.id) {
        const { error } = await withTimeout<{
          error: { message: string } | null;
        }>(
          (signal) =>
            supabase.from("artists").update(payload).eq("id", form.id).abortSignal(signal),
          30000,
          mutationAbortController
        );
        if (error) {
          setToast({ type: "error", message: `Kaydetme başarısız: ${error.message}` });
          return;
        }
        setArtists((prev) =>
          prev.map((artist) =>
            artist.id === form.id
              ? {
                  ...artist,
                  name: payload.name,
                  slug: payload.slug,
                  image_url: payload.image_url,
                }
              : artist
          )
        );
      } else {
        const { data, error } = await withTimeout<{
          data: { id: string } | null;
          error: { message: string } | null;
        }>(
          (signal) =>
            supabase
              .from("artists")
              .insert(payload)
              .select("id")
            .abortSignal(signal)
            .single(),
          30000,
          mutationAbortController
        );
        if (error) {
          setToast({ type: "error", message: `Kaydetme başarısız: ${error.message}` });
          return;
        }
        setForm((prev) => ({ ...prev, id: data.id, slug }));
        setArtists((prev) => [
          ...prev,
          {
            id: data.id,
            name: payload.name,
            slug: payload.slug,
            image_url: payload.image_url,
          },
        ]);
      }

      void loadArtists({ quiet: true });
      setToast({ type: "success", message: "Sanatçı kaydedildi." });
    } catch (error) {
      setToast({ type: "error", message: `Kaydetme başarısız: ${(error as Error).message}` });
    } finally {
      clearTimeout(watchdogId);
      if (activeMutationIdRef.current === mutationId) {
        activeMutationIdRef.current = 0;
        activeMutationAbortRef.current = null;
        setSaving(false);
      }
    }
  }

  useEffect(() => {
    if (isAdmin) {
      loadArtists();
    }
  }, [isAdmin]);

  if (authLoading) {
    return <div className="p-8 text-slate-500">Yükleniyor...</div>;
  }

  if (!isAdmin) {
    return <div className="p-8">Bu sayfayı görüntülemek için yönetici girişi gerekli.</div>;
  }

  return (
    <div className="p-6 md:p-8">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
            toast.type === "success"
              ? "bg-green-600 text-white"
              : toast.type === "warning"
                ? "bg-amber-500 text-white"
                : "bg-red-600 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Sanatçılar</h1>
        <p className="text-slate-600 mt-1">
          Sanatçı biyografisi, ana görsel ve ek 2-3 fotoğrafı buradan yönetebilirsiniz.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-1 bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <input
              type="text"
              placeholder="Sanatçı ara..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              onClick={handleNew}
              className="rounded-lg bg-primary-600 text-white px-3 py-2 text-sm hover:bg-primary-700"
            >
              Yeni sanatçı ekle
            </button>
          </div>

          <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
            {loading && <p className="text-sm text-slate-500">Yükleniyor...</p>}
            {!loading && filteredArtists.length === 0 && (
              <p className="text-sm text-slate-500">Kayıt bulunamadı.</p>
            )}
            {filteredArtists.map((artist) => (
              <button
                key={artist.id}
                onClick={() => loadArtist(artist.id)}
                className={`w-full text-left rounded-lg border px-3 py-2 transition ${
                  form.id === artist.id
                    ? "border-primary-300 bg-primary-50"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <p className="font-medium text-slate-900">{artist.name}</p>
                <p className="text-xs text-slate-500">/{artist.slug}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="xl:col-span-2 bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <div className="rounded-lg border border-slate-200 p-4 bg-slate-50/50">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Sanatçı Adı (TR zorunlu, DE/EN opsiyonel)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-0.5">Türkçe *</label>
                <input
                  value={form.name_tr || form.name}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFormField("name_tr", v);
                    setFormField("name", v);
                    if (!form.id) setFormField("slug", slugify(v));
                  }}
                  placeholder="Sanatçı adı (TR)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-0.5">Almanca</label>
                <input
                  value={form.name_de}
                  onChange={(e) => setFormField("name_de", e.target.value)}
                  placeholder="Sanatçı adı (DE)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-0.5">İngilizce</label>
                <input
                  value={form.name_en}
                  onChange={(e) => setFormField("name_en", e.target.value)}
                  placeholder="Sanatçı adı (EN)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={form.slug}
              onChange={(e) => setFormField("slug", slugify(e.target.value))}
              placeholder="slug"
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Sanatçı Kartı Yazısı (/sanatci için)
              </label>
              <textarea
                value={form.card_text}
                onChange={(e) => setFormField("card_text", e.target.value)}
                placeholder="Liste kartında görünecek metni buraya yazın (boş bırakılırsa biyografiden otomatik alınır)."
                rows={4}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Kart Yazı Uzunluğu (Satır)
              </label>
              <select
                value={form.card_lines}
                onChange={(e) => setFormField("card_lines", Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                {CARD_LINE_OPTIONS.map((lineCount) => (
                  <option key={lineCount} value={lineCount}>
                    {lineCount} satır
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Ana Fotoğraf</label>
            <AdminImageUploadFixed
              value={form.image_url}
              onChange={(url: string) => setFormField("image_url", url)}
              folder="artist-images"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Ek Fotoğraf 1</label>
              <AdminImageUploadFixed
                value={form.gallery_1}
                onChange={(url: string) => setFormField("gallery_1", url)}
                folder="artist-images"
              />
              <select
                value={form.gallery_1_position}
                onChange={(e) => setFormField("gallery_1_position", e.target.value as ArtistGalleryPosition)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {GALLERY_POSITION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Ek Fotoğraf 2</label>
              <AdminImageUploadFixed
                value={form.gallery_2}
                onChange={(url: string) => setFormField("gallery_2", url)}
                folder="artist-images"
              />
              <select
                value={form.gallery_2_position}
                onChange={(e) => setFormField("gallery_2_position", e.target.value as ArtistGalleryPosition)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {GALLERY_POSITION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Ek Fotoğraf 3</label>
              <AdminImageUploadFixed
                value={form.gallery_3}
                onChange={(url: string) => setFormField("gallery_3", url)}
                folder="artist-images"
              />
              <select
                value={form.gallery_3_position}
                onChange={(e) => setFormField("gallery_3_position", e.target.value as ArtistGalleryPosition)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {GALLERY_POSITION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={form.video_1_url}
              onChange={(e) => setFormField("video_1_url", e.target.value)}
              placeholder="Video 1 linki (YouTube - opsiyonel)"
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
            <input
              value={form.video_2_url}
              onChange={(e) => setFormField("video_2_url", e.target.value)}
              placeholder="Video 2 linki (YouTube - opsiyonel)"
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
            <input
              value={form.video_3_url}
              onChange={(e) => setFormField("video_3_url", e.target.value)}
              placeholder="Video 3 linki (YouTube - opsiyonel)"
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={form.youtube_url}
              onChange={(e) => setFormField("youtube_url", e.target.value)}
              placeholder="YouTube linki (opsiyonel)"
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
            <input
              value={form.spotify_url}
              onChange={(e) => setFormField("spotify_url", e.target.value)}
              placeholder="Spotify linki (opsiyonel)"
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
            <input
              value={form.instagram_url}
              onChange={(e) => setFormField("instagram_url", e.target.value)}
              placeholder="Instagram linki (opsiyonel)"
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
            <input
              value={form.website_url}
              onChange={(e) => setFormField("website_url", e.target.value)}
              placeholder="Web sitesi linki (opsiyonel)"
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Biyografi / Özgeçmiş (TR zorunlu, DE/EN opsiyonel)</label>
            <div className="space-y-4">
              <div>
                <span className="text-xs text-slate-500 font-medium">Türkçe *</span>
                <div className="border border-slate-200 rounded-lg overflow-hidden mt-1">
                  <MDEditor
                    value={form.bio_tr || form.bio}
                    onChange={(val) => {
                      setFormField("bio_tr", val || "");
                      setFormField("bio", val || "");
                    }}
                    preview="edit"
                    height={220}
                  />
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-500 font-medium">Almanca</span>
                <div className="border border-slate-200 rounded-lg overflow-hidden mt-1">
                  <MDEditor
                    value={form.bio_de}
                    onChange={(val) => setFormField("bio_de", val || "")}
                    preview="edit"
                    height={180}
                  />
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-500 font-medium">İngilizce</span>
                <div className="border border-slate-200 rounded-lg overflow-hidden mt-1">
                  <MDEditor
                    value={form.bio_en}
                    onChange={(val) => setFormField("bio_en", val || "")}
                    preview="edit"
                    height={180}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving || loadingArtist}
              className="rounded-lg bg-primary-600 text-white px-4 py-2 hover:bg-primary-700 disabled:opacity-60"
            >
              {isSaving ? "Kaydediliyor..." : loadingArtist ? "Yükleniyor..." : "Kaydet"}
            </button>
            {form.id && (
              <button
                onClick={handleDelete}
                disabled={isSaving || loadingArtist}
                className="rounded-lg bg-red-600 text-white px-4 py-2 hover:bg-red-700 disabled:opacity-60"
              >
                Sil
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

