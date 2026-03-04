"use client";

import { useState, useRef } from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/lib/supabase-client";
import { validateImageFile, getImageHint } from "@/lib/image-standards";

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  onRemove: () => void;
}

export default function ImageUpload({ value, onChange, onRemove }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadImage(file: File) {
    setUploading(true);
    
    try {
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `event-images/${fileName}`;


      const { error: uploadError } = await supabase.storage
        .from('event-images')
        .upload(filePath, file);


      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('event-images')
        .getPublicUrl(filePath);

      
      onChange(publicUrl);
    } catch (error) {
      console.error('Resim yüklenemedi:', error);
      alert('Resim yüklenemedi: ' + (error as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Resim boyutu 5MB\'dan küçük olmalıdır.');
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        alert('Lütfen bir resim dosyası seçin.');
        return;
      }
      
      uploadImage(file);
    }
  }

  function handleRemove() {
    onRemove();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700 mb-2">
        Etkinlik Görseli
      </label>
      
      {value ? (
        <div className="relative group">
          <div className="w-full h-48 rounded-lg overflow-hidden border border-slate-200">
            <img
              src={value}
              alt="Etkinlik görseli"
              className="w-full h-full object-cover"
            />
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="border-2 border-dashed border-slate-300 rounded-lg p-6">
          <div className="text-center">
            <ImageIcon className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <div className="text-sm text-slate-600 mb-2">
              Etkinlik görseli yüklemek için tıklayın
            </div>
            <div className="text-xs text-slate-500 mb-4">
              {getImageHint("EVENT_DETAIL")}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              disabled={uploading}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Yükleniyor...' : 'Resim Seç'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
