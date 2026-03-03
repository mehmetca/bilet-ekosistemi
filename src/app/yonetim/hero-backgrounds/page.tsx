"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Upload, Image as ImageIcon, Eye, EyeOff, MoveUp, MoveDown } from "lucide-react";
import { supabase } from "@/lib/supabase-client";
import AdminGuard from "@/components/AdminGuard";

interface HeroBackground {
  id: string;
  title: string;
  image_url: string;
  is_active: boolean;
  sort_order: number;
  transition_duration: number;
  created_at: string;
}

export default function HeroBackgroundManagement() {
  const [backgrounds, setBackgrounds] = useState<HeroBackground[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    title: "",
    image_url: "",
    transition_duration: 5000,
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchBackgrounds();
  }, []);

  async function fetchBackgrounds() {
    try {
      const { data, error } = await supabase
        .from("hero_backgrounds")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) throw error;
      setBackgrounds(data || []);
    } catch (error) {
      console.error("Background fetch error:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Debug: Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    console.log("Current user:", user);
    console.log("User metadata:", user?.user_metadata);
    console.log("App metadata:", user?.app_metadata);

    setUploading(true);
    try {
      const fileName = `hero-backgrounds/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("hero-backgrounds")
        .upload(fileName, file);

      if (uploadError) {
        console.error("Upload error details:", uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("hero-backgrounds")
        .getPublicUrl(fileName);

      setFormData(prev => ({ ...prev, image_url: publicUrl }));
    } catch (error) {
      console.error("Upload error:", error);
      alert("Resim yüklenirken hata oluştu: " + (error as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.title || !formData.image_url) {
      alert("Lütfen tüm alanları doldurun");
      return;
    }

    try {
      const { error } = await supabase
        .from("hero_backgrounds")
        .insert({
          ...formData,
          sort_order: backgrounds.length,
        });

      if (error) throw error;

      setFormData({ title: "", image_url: "", transition_duration: 5000 });
      fetchBackgrounds();
    } catch (error) {
      console.error("Insert error:", error);
      alert("Background eklenirken hata oluştu");
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    try {
      const { error } = await supabase
        .from("hero_backgrounds")
        .update({ is_active: !isActive })
        .eq("id", id);

      if (error) throw error;
      fetchBackgrounds();
    } catch (error) {
      console.error("Toggle error:", error);
    }
  }

  async function deleteBackground(id: string) {
    if (!confirm("Bu background'ı silmek istediğinizden emin misiniz?")) return;

    try {
      const { error } = await supabase
        .from("hero_backgrounds")
        .delete()
        .eq("id", id);

      if (error) throw error;
      fetchBackgrounds();
    } catch (error) {
      console.error("Delete error:", error);
    }
  }

  async function moveBackground(id: string, direction: 'up' | 'down') {
    const currentIndex = backgrounds.findIndex(bg => bg.id === id);
    if (
      (direction === 'up' && currentIndex === 0) ||
      (direction === 'down' && currentIndex === backgrounds.length - 1)
    ) {
      return;
    }

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const newBackgrounds = [...backgrounds];
    
    // Swap sort orders
    const temp = newBackgrounds[currentIndex].sort_order;
    newBackgrounds[currentIndex].sort_order = newBackgrounds[newIndex].sort_order;
    newBackgrounds[newIndex].sort_order = temp;

    try {
      // Batch update - her birini ayrı güncelle
      const updates = [
        supabase
          .from("hero_backgrounds")
          .update({ sort_order: newBackgrounds[currentIndex].sort_order })
          .eq("id", newBackgrounds[currentIndex].id),
        supabase
          .from("hero_backgrounds")
          .update({ sort_order: newBackgrounds[newIndex].sort_order })
          .eq("id", newBackgrounds[newIndex].id)
      ];

      const results = await Promise.all(updates);
      
      // Hata kontrolü
      const hasError = results.some(result => result.error);
      if (hasError) {
        throw new Error("Reorder failed");
      }

      fetchBackgrounds();
    } catch (error) {
      console.error("Reorder error:", error);
      alert("Sıralama güncellenirken hata oluştu");
    }
  }

  if (loading) {
    return (
      <AdminGuard>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-slate-200 rounded w-1/4 mb-6"></div>
            <div className="grid gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-slate-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Hero Background Yönetimi</h1>

        {/* Yeni Background Ekle */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Yeni Background Ekle</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Başlık
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Background başlığı"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Görsel
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors"
                >
                  {uploading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-600 border-t-transparent"></div>
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {uploading ? "Yükleniyor..." : "Resim Yükle"}
                </label>
                {formData.image_url && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <ImageIcon className="h-4 w-4" />
                    Resim yüklendi
                  </div>
                )}
              </div>
              {formData.image_url && (
                <div className="mt-2">
                  <img
                    src={formData.image_url}
                    alt="Preview"
                    className="h-20 w-auto rounded-lg border border-slate-200"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Geçiş Süresi (ms)
              </label>
              <input
                type="number"
                value={formData.transition_duration}
                onChange={(e) => setFormData(prev => ({ ...prev, transition_duration: parseInt(e.target.value) }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                min="1000"
                max="10000"
                step="500"
              />
            </div>

            <button
              type="submit"
              disabled={uploading || !formData.image_url}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="h-4 w-4" />
              Background Ekle
            </button>
          </form>
        </div>

        {/* Mevcut Background'lar */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Mevcut Background'lar</h2>
          {backgrounds.length === 0 ? (
            <p className="text-slate-500 text-center py-8">
              Henüz background eklenmemiş.
            </p>
          ) : (
            <div className="space-y-4">
              {backgrounds.map((bg, index) => (
                <div
                  key={bg.id}
                  className="flex items-center gap-4 p-4 border border-slate-200 rounded-lg"
                >
                  <img
                    src={bg.image_url}
                    alt={bg.title}
                    className="w-24 h-16 object-cover rounded-lg"
                  />
                  
                  <div className="flex-1">
                    <h3 className="font-medium text-slate-900">{bg.title}</h3>
                    <p className="text-sm text-slate-600">
                      Geçiş: {bg.transition_duration}ms
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => moveBackground(bg.id, 'up')}
                      disabled={index === 0}
                      className="p-2 text-slate-600 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <MoveUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => moveBackground(bg.id, 'down')}
                      disabled={index === backgrounds.length - 1}
                      className="p-2 text-slate-600 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <MoveDown className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => toggleActive(bg.id, bg.is_active)}
                      className={`p-2 rounded-lg ${
                        bg.is_active
                          ? "text-green-600 hover:text-green-700"
                          : "text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      {bg.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => deleteBackground(bg.id)}
                      className="p-2 text-red-600 hover:text-red-700"
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
    </AdminGuard>
  );
}
