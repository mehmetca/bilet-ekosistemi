"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, X, Image as ImageIcon, Search as SearchIcon, Grid2x2 } from "lucide-react";
import { getAccessTokenForApi } from "@/lib/supabase-auth-token";
import { validateImageFile, getImageHint } from "@/lib/image-standards";
import { compressImageFile } from "@/lib/image-compress";

interface AdminImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
  /** Storage klasörü — yükleme ve galeri aynı yerden */
  folder?: string;
  /** Boş string verilirse iç etiket gizlenir (dışarıda zaten label varsa) */
  label?: string;
}

export default function AdminImageUpload({
  value,
  onChange,
  onUploadingChange,
  folder = "images",
  label = "Etkinlik Görseli",
}: AdminImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [libraryImages, setLibraryImages] = useState<Array<{ path: string; url: string; name: string }>>([]);

  const libraryFiltered = useMemo(() => {
    const q = libraryQuery.trim().toLowerCase();
    if (!q) return libraryImages;
    return libraryImages.filter((img) => img.name.toLowerCase().includes(q));
  }, [libraryImages, libraryQuery]);

  async function loadLibrary() {
    setLibraryLoading(true);
    setLibraryError(null);
    try {
      const token = await getAccessTokenForApi();
      if (!token) {
        alert("Oturum bulunamadı veya süresi doldu. Lütfen sayfayı yenileyip tekrar giriş yapın.");
        return;
      }

      const res = await fetch(`/api/list-images?folder=${encodeURIComponent(folder)}&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "same-origin",
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "Liste alınamadı.");
      }

      const payload = (await res.json()) as { images?: Array<{ path: string; url: string; name: string }> };
      setLibraryImages(payload.images || []);
    } catch (e) {
      setLibraryError(e instanceof Error ? e.message : "Liste alınamadı");
    } finally {
      setLibraryLoading(false);
    }
  }

  useEffect(() => {
    if (!libraryOpen) return;
    loadLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryOpen, folder]);

  async function uploadImage(file: File) {
    setUploading(true);
    onUploadingChange?.(true);

    try {
      // Egress/band genişliğini azaltmak için önce tarayıcıda küçült.
      const compressedFile = await compressImageFile(file);
      const token = await getAccessTokenForApi();
      if (!token) {
        alert("Oturum bulunamadı veya süresi doldu. Lütfen sayfayı yenileyip tekrar giriş yapın.");
        return;
      }

      const formData = new FormData();
      formData.append("file", compressedFile);
      formData.append("folder", folder);
      formData.append("access_token", token);

      const response = await fetch("/api/upload", {
        method: "POST",
        credentials: "same-origin",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error || "Gorsel yuklenemedi.");
      }

      const payload = (await response.json()) as { url?: string };
      if (!payload.url) {
        throw new Error("Yuklenen gorsel URL'i alinmadi.");
      }
      onChange(payload.url);
    } catch (error) {
      console.error("Resim yüklenemedi:", error);
      alert("Resim yüklenemedi: " + (error as Error).message);
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  }

  function handleFileSelect(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    const err = validateImageFile(file, false);
    if (err) {
      alert(err);
      return;
    }
    uploadImage(file);
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files);
    }
  }

  return (
    <div className="space-y-2">
      {label ? (
        <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          handleFileSelect(e.target.files);
          e.target.value = "";
        }}
        className="hidden"
      />

      {libraryOpen && (
        <div
          className="fixed inset-0 z-[2000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Görsel Galerisi"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setLibraryOpen(false);
          }}
        >
          <div className="w-full max-w-4xl rounded-2xl border border-white/20 bg-white shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Grid2x2 className="h-4 w-4 text-primary-600" />
                <h3 className="font-semibold text-slate-900 text-sm">Önceki görsellerden seç</h3>
              </div>
              <button
                type="button"
                onClick={() => setLibraryOpen(false)}
                className="rounded-lg p-2 hover:bg-slate-100 text-slate-600"
                aria-label="Kapat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  value={libraryQuery}
                  onChange={(e) => setLibraryQuery(e.target.value)}
                  placeholder="Dosya adına göre ara..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-10 py-2.5 text-sm focus:border-primary-500 focus:ring-primary-500"
                />
              </div>

              {libraryLoading ? (
                <div className="text-sm text-slate-600">Görseller yükleniyor...</div>
              ) : libraryError ? (
                <div className="text-sm text-red-600">{libraryError}</div>
              ) : libraryFiltered.length === 0 ? (
                <div className="text-sm text-slate-500">Henüz yüklenmiş görsel bulunamadı.</div>
              ) : (
                <div className="max-h-[55vh] overflow-auto">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {libraryFiltered.map((img, idx) => (
                      <button
                        key={`${img.path}-${idx}`}
                        type="button"
                        onClick={() => {
                          onChange(img.url);
                          setLibraryOpen(false);
                        }}
                        className={`rounded-xl overflow-hidden border bg-slate-50 hover:border-primary-300 hover:shadow-sm transition-shadow ${
                          img.url === value ? "border-primary-500" : "border-slate-200"
                        }`}
                        title={img.name}
                      >
                        <img src={img.url} alt={img.name} className="h-24 w-full object-cover object-top" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {value ? (
        <div className="relative">
          <img
            src={value}
            alt="Seçili görsel"
            className="w-full h-48 object-cover object-top rounded-lg"
          />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div
          className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? "border-primary-500 bg-primary-50"
              : "border-slate-300 hover:border-slate-400"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center">
            <ImageIcon className="h-12 w-12 text-slate-400 mb-4" />
            <div className="text-sm text-slate-600">
              <p className="font-medium">Görsel yüklemek için tıklayın veya sürükleyin</p>
              <p className="text-xs text-slate-500 mt-1">{getImageHint("EVENT_DETAIL")}</p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {uploading ? "Yükleniyor..." : "Dosya Seç"}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          className="flex items-center gap-2 rounded-lg border border-primary-200 bg-white px-3 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-50"
        >
          <Grid2x2 className="h-4 w-4" />
          Önceki görsellerden seç
        </button>
        {value ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Yükleniyor..." : "Yeni yükle"}
          </button>
        ) : null}
      </div>

      <div className="text-xs text-slate-500">Veya görsel URL&apos;si girin:</div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://example.com/image.jpg veya /uploads/dosya.webp"
        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
      />
    </div>
  );
}
