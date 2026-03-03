"use client";

import { useState, useRef } from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";

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

  async function uploadImage(file: File) {
    setUploading(true);
    onUploadingChange?.(true);
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);

      const response = await fetch("/api/upload", {
        method: "POST",
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
        Etkinlik Görseli
      </label>
      
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
