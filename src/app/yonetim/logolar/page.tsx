"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ImageOff, RotateCcw, Save, Upload } from "lucide-react";
import { getAccessTokenForApi } from "@/lib/supabase-auth-token";
import AdminOnlyGuard from "@/components/AdminOnlyGuard";
import { compressImageFile } from "@/lib/image-compress";
import { DEFAULT_BRANDING, type Branding } from "@/lib/branding";

type SlotKey = keyof Branding;

const SLOTS: { key: SlotKey; title: string; hint: string; dark: boolean }[] = [
  {
    key: "logoHeader",
    title: "Üst Menü Logosu",
    hint: "Açık zeminde kullanılır. Şeffaf PNG önerilir, yükseklik ~50px.",
    dark: false,
  },
  {
    key: "logoFooter",
    title: "Alt Bilgi Logosu",
    hint: "Koyu zeminde kullanılır. Açık renkli (beyaz/kırmızı) versiyonu yükleyin.",
    dark: true,
  },
  {
    key: "favicon",
    title: "Favicon (sekme simgesi)",
    hint: "Kare PNG (64x64 veya 192x192). Tarayıcı sekmesinde site adının yanında görünür.",
    dark: false,
  },
];

export default function BrandingLogosPage() {
  const [branding, setBranding] = useState<Branding>({ ...DEFAULT_BRANDING });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<SlotKey | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputs = useRef<Partial<Record<SlotKey, HTMLInputElement | null>>>({});

  useEffect(() => {
    let active = true;
    fetch("/api/branding/")
      .then((res) => res.json())
      .then((data) => {
        if (!active || !data || typeof data !== "object") return;
        setBranding({
          logoHeader: data.logoHeader || DEFAULT_BRANDING.logoHeader,
          logoFooter: data.logoFooter || DEFAULT_BRANDING.logoFooter,
          favicon: data.favicon || DEFAULT_BRANDING.favicon,
        });
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleUpload(key: SlotKey, file: File) {
    setUploadingKey(key);
    setError(null);
    setMessage(null);
    try {
      const compressed = await compressImageFile(file);
      const token = await getAccessTokenForApi();
      if (!token) throw new Error("Oturum bulunamadı");
      const form = new FormData();
      form.append("file", compressed);
      form.append("folder", "branding");
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const payload = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !payload.url) throw new Error(payload.error || "Yükleme başarısız");
      setBranding((prev) => ({ ...prev, [key]: payload.url as string }));
    } catch (e) {
      setError("Görsel yüklenemedi: " + (e as Error).message);
    } finally {
      setUploadingKey(null);
      if (fileInputs.current[key]) fileInputs.current[key]!.value = "";
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const token = await getAccessTokenForApi();
      if (!token) throw new Error("Oturum bulunamadı");
      const res = await fetch("/api/branding/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(branding),
      });
      const payload = (await res.json()) as { error?: string } & Partial<Branding>;
      if (!res.ok) throw new Error(payload.error || "Kaydedilemedi");
      setMessage("Kaydedildi. Açık sekmelerde yenileme sonrası görünür.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function resetSlot(key: SlotKey) {
    setBranding((prev) => ({ ...prev, [key]: DEFAULT_BRANDING[key] }));
  }

  if (loading) {
    return (
      <AdminOnlyGuard>
        <div className="p-6 text-slate-600">Yükleniyor...</div>
      </AdminOnlyGuard>
    );
  }

  return (
    <AdminOnlyGuard>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Logo ve Simgeler</h1>
        <p className="mb-6 text-sm text-slate-600">
          Yüklediğin görseller sitede bu alanların yerine kullanılır. Değiştirmek için yeni dosya
          yükle ve <strong>Kaydet</strong>'e bas.
        </p>

        <div className="grid gap-4 lg:grid-cols-3">
          {SLOTS.map((slot) => (
            <div key={slot.key} className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-1 font-semibold text-slate-900">{slot.title}</h2>
              <p className="mb-3 text-xs leading-5 text-slate-500">{slot.hint}</p>
              <div
                className={`mb-3 flex h-28 items-center justify-center overflow-hidden rounded-lg border ${
                  slot.dark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                }`}
              >
                {branding[slot.key] ? (
                  <img
                    src={branding[slot.key]}
                    alt={slot.title}
                    className="max-h-24 max-w-full object-contain"
                  />
                ) : (
                  <ImageOff className="h-6 w-6 text-slate-400" />
                )}
              </div>
              <input
                ref={(el) => {
                  fileInputs.current[slot.key] = el;
                }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleUpload(slot.key, file);
                }}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileInputs.current[slot.key]?.click()}
                  disabled={uploadingKey === slot.key}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-200 disabled:opacity-60"
                >
                  <Upload className="h-4 w-4" />
                  {uploadingKey === slot.key ? "Yükleniyor..." : "Görsel Yükle"}
                </button>
                <button
                  type="button"
                  onClick={() => resetSlot(slot.key)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  Varsayılan
                </button>
              </div>
              <p className="mt-2 break-all text-xs text-slate-400">{branding[slot.key]}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {saving ? <Upload className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
          {message ? (
            <span className="inline-flex items-center gap-1 text-sm text-green-700">
              <Check className="h-4 w-4" />
              {message}
            </span>
          ) : null}
          {error ? <span className="text-sm text-red-600">{error}</span> : null}
        </div>
      </div>
    </AdminOnlyGuard>
  );
}
