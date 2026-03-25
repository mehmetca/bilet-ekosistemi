"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, X, Image as ImageIcon, Search, Grid2X2 } from "lucide-react";
import { getAccessTokenForApi } from "@/lib/supabase-auth-token";

interface AdminImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  currentImage?: string;
  folder?: string;
  onUploadingChange?: (uploading: boolean) => void;
}

export default function AdminImageUploadFixed({
  value,
  onChange,
  currentImage,
  folder = "event-images",
  onUploadingChange,
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

      const res = await fetch(`/api/list-images?folder=${encodeURIComponent(folder)}&limit=40`, {
        headers: { Authorization: `Bearer ${token}` },
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
    // folder değişince de liste yenilensin
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryOpen, folder]);

  async function uploadImage(file: File) {
    setUploading(true);
    onUploadingChange?.(true);
    
    try {
      const token = await getAccessTokenForApi();
      if (!token) {
        alert("Oturum bulunamadı veya süresi doldu. Lütfen sayfayı yenileyip tekrar giriş yapın.");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
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
      console.error('Resim yüklenemedi:', error);
      alert('Resim yüklenemedi: ' + (error as Error).message);
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  }

  function handleFileSelect(files: FileList | null) {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    
    if (!validTypes.includes(file.type)) {
      alert('Sadece JPEG, PNG, GIF ve WebP formatları kabul edilir.');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB
      alert('Dosya boyutu 5MB\'dan küçük olmalıdır.');
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
      <label className="block text-sm font-medium text-slate-700 mb-2">
        Görsel
      </label>

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
                <Grid2X2 className="h-4 w-4 text-primary-600" />
                <h3 className="font-semibold text-slate-900 text-sm">Galeriden seç</h3>
                <span className="text-xs text-slate-500">({folder})</span>
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  value={libraryQuery}
                  onChange={(e) => setLibraryQuery(e.target.value)}
                  placeholder="Ara..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-10 py-2.5 text-sm focus:border-primary-500 focus:ring-primary-500"
                />
              </div>

              {libraryLoading ? (
                <div className="text-sm text-slate-600">Görseller yükleniyor...</div>
              ) : libraryError ? (
                <div className="text-sm text-red-600">{libraryError}</div>
              ) : libraryFiltered.length === 0 ? (
                <div className="text-sm text-slate-500">Bu klasörde görsel bulunamadı.</div>
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
            alt="Etkinlik görseli"
            className="w-full h-48 object-cover object-top rounded-lg"
          />
          <button
            type="button"
            onClick={() => {
              onChange("");
            }}
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
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
          />
          
          <div className="flex flex-col items-center">
            <ImageIcon className="h-12 w-12 text-slate-400 mb-4" />
            <div className="text-sm text-slate-600">
              <p className="font-medium">Görsel yüklemek için tıklayın veya sürükleyin</p>
              <p className="text-xs text-slate-500 mt-1">
                PNG, JPG, GIF, WebP (Max 5MB)
              </p>
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

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          <Grid2X2 className="h-4 w-4" />
          Galeriden seç
        </button>
      </div>
      
      <div className="text-xs text-slate-500">
        Veya görsel URL'si girin:
      </div>
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
