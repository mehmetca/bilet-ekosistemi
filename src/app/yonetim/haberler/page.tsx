"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Edit2, Trash2, Eye, EyeOff, FileText, Upload, X } from "lucide-react";
import type { News } from "@/types/database";
import MDEditor from '@uiw/react-md-editor';

import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import AdminOnlyGuard from "@/components/AdminOnlyGuard";
import { getAccessTokenForApi } from "@/lib/supabase-auth-token";

export default function HaberlerPage() {
  const { isAdmin, loading: authLoading } = useSimpleAuth();
  const searchParams = useSearchParams();
  const yeniHaber = searchParams.get("yeni");
  
  const [news, setNews] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(yeniHaber === "true");
  const [editingNews, setEditingNews] = useState<News | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    summary: "",
    excerpt: "",
    title_tr: "",
    title_de: "",
    title_en: "",
    content_tr: "",
    content_de: "",
    content_en: "",
    excerpt_tr: "",
    excerpt_de: "",
    excerpt_en: "",
    image_url: "",
    is_published: false,
  });

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      const response = await fetch("/api/news");
      const data = await response.json();
      setNews(data);
    } catch (error) {
      console.error("Haberler yüklenemedi:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  setUploading(true);
  
  try {
    const token = await getAccessTokenForApi();
    if (!token) {
      alert("Oturum bulunamadı veya süresi doldu. Lütfen sayfayı yenileyip tekrar giriş yapın.");
      return;
    }

    const uploadFormData = new FormData();
    uploadFormData.append("file", file);

    const response = await fetch("/api/upload", {
      method: "POST",
      credentials: "same-origin",
      headers: { Authorization: `Bearer ${token}` },
      body: uploadFormData,
    });
    
    if (response.ok) {
      const result = await response.json();
      setFormData(prev => ({ ...prev, image_url: result.url }));
    } else {
      alert('Görsel yüklenemedi!');
    }
  } catch (error) {
    console.error('Upload error:', error);
    alert('Görsel yüklenemedi!');
  } finally {
    setUploading(false);
  }
};

const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const titleVal = formData.title_tr?.trim() || formData.title.trim();
    const contentVal = formData.content_tr?.trim() || formData.content.trim();
    const excerptVal = formData.excerpt_tr?.trim() || formData.summary?.trim() || formData.excerpt?.trim() || "";
    const payload = {
      title: titleVal,
      content: contentVal,
      excerpt: excerptVal,
      summary: excerptVal,
      image_url: formData.image_url || null,
      is_published: formData.is_published,
      title_tr: formData.title_tr?.trim() || null,
      title_de: formData.title_de?.trim() || null,
      title_en: formData.title_en?.trim() || null,
      content_tr: formData.content_tr?.trim() || null,
      content_de: formData.content_de?.trim() || null,
      content_en: formData.content_en?.trim() || null,
      excerpt_tr: formData.excerpt_tr?.trim() || formData.summary?.trim() || null,
      excerpt_de: formData.excerpt_de?.trim() || null,
      excerpt_en: formData.excerpt_en?.trim() || null,
    };
    try {
      const url = editingNews ? `/api/news/${editingNews.id}` : "/api/news";
      const method = editingNews ? "PUT" : "POST";
      
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await fetchNews();
        resetForm();
      } else {
        const errorData = await response.json();
        console.error("Save error:", errorData);
        alert(errorData.error || 'Haber kaydedilemedi!');
      }
    } catch (error) {
      console.error("Haber kaydedilemedi:", error);
      alert('Haber kaydedilemdi!');
    }
  };

  const handleEdit = (newsItem: News) => {
    setEditingNews(newsItem);
    const item = newsItem as unknown as Record<string, unknown>;
    setFormData({
      title: newsItem.title,
      content: newsItem.content,
      summary: (item.summary as string) || (item.excerpt as string) || "",
      excerpt: (item.excerpt as string) || (item.summary as string) || "",
      title_tr: (item.title_tr as string) || newsItem.title,
      title_de: (item.title_de as string) || "",
      title_en: (item.title_en as string) || "",
      content_tr: (item.content_tr as string) || newsItem.content,
      content_de: (item.content_de as string) || "",
      content_en: (item.content_en as string) || "",
      excerpt_tr: (item.excerpt_tr as string) || (item.excerpt as string) || (item.summary as string) || "",
      excerpt_de: (item.excerpt_de as string) || "",
      excerpt_en: (item.excerpt_en as string) || "",
      image_url: newsItem.image_url || "",
      is_published: newsItem.is_published ?? false,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu haberi silmek istediğinizden emin misiniz?")) return;
    
    try {
      const response = await fetch(`/api/news/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchNews();
      }
    } catch (error) {
      console.error("Haber silinemedi:", error);
    }
  };

  const togglePublish = async (id: string, isPublished: boolean) => {
    try {
      const response = await fetch(`/api/news/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_published: !isPublished }),
      });

      if (response.ok) {
        await fetchNews();
      }
    } catch (error) {
      console.error("Durum güncellenemedi:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      content: "",
      summary: "",
      excerpt: "",
      title_tr: "",
      title_de: "",
      title_en: "",
      content_tr: "",
      content_de: "",
      content_en: "",
      excerpt_tr: "",
      excerpt_de: "",
      excerpt_en: "",
      image_url: "",
      is_published: false,
    });
    setEditingNews(null);
    setShowForm(false);
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <AdminOnlyGuard>
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Haber Yönetimi</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Yeni Haber
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            {editingNews ? "Haber Düzenle" : "Yeni Haber Ekle"}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-lg border border-slate-200 p-4 bg-slate-50/50">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Başlık (TR zorunlu, DE/EN opsiyonel)</h3>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-slate-500 mb-0.5">Türkçe *</label>
                  <input
                    type="text"
                    value={formData.title_tr || formData.title}
                    onChange={(e) => setFormData({ ...formData, title_tr: e.target.value, title: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-primary-500 focus:ring-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-0.5">Almanca</label>
                  <input
                    type="text"
                    value={formData.title_de}
                    onChange={(e) => setFormData({ ...formData, title_de: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-0.5">İngilizce</label>
                  <input
                    type="text"
                    value={formData.title_en}
                    onChange={(e) => setFormData({ ...formData, title_en: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-4 bg-slate-50/50">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Özet (TR / DE / EN)</h3>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-slate-500 mb-0.5">Türkçe</label>
                  <input
                    type="text"
                    value={formData.excerpt_tr || formData.summary}
                    onChange={(e) => setFormData({ ...formData, excerpt_tr: e.target.value, summary: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    placeholder="Kısa açıklama"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-0.5">Almanca</label>
                  <input
                    type="text"
                    value={formData.excerpt_de}
                    onChange={(e) => setFormData({ ...formData, excerpt_de: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-0.5">İngilizce</label>
                  <input
                    type="text"
                    value={formData.excerpt_en}
                    onChange={(e) => setFormData({ ...formData, excerpt_en: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Görsel
              </label>
              <div className="space-y-2">
                {/* Mevcut Görsel */}
                {formData.image_url && (
                  <div className="relative">
                    <img
                      src={formData.image_url}
                      alt="Mevcut görsel"
                      className="w-full h-48 object-cover rounded-lg border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, image_url: "" }))}
                      className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                
                {/* Yükleme Alanı */}
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center">
                  <input
                    type="file"
                    id="image_upload"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                  <label
                    htmlFor="image_upload"
                    className="cursor-pointer flex flex-col items-center gap-2 text-slate-600 hover:text-primary-600 transition-colors"
                  >
                    {uploading ? (
                      <>
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                        <span className="text-sm">Yükleniyor...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-8 w-8" />
                        <span className="text-sm">Görsel Yükle</span>
                        <span className="text-xs text-slate-500">veya sürükleyip bırakın</span>
                      </>
                    )}
                  </label>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                İçerik (TR zorunlu, DE/EN opsiyonel)
              </label>
              <div className="space-y-4">
                <div>
                  <span className="text-xs text-slate-500 font-medium">Türkçe *</span>
                  <div className="border border-slate-300 rounded-lg overflow-hidden mt-1">
                    <MDEditor
                      value={formData.content_tr || formData.content}
                      onChange={(value: string | undefined) => setFormData(prev => ({ ...prev, content_tr: value || "", content: value || "" }))}
                      height={260}
                      preview="edit"
                      hideToolbar={false}
                      visibleDragbar={false}
                    />
                  </div>
                </div>
                <div>
                  <span className="text-xs text-slate-500 font-medium">Almanca</span>
                  <div className="border border-slate-300 rounded-lg overflow-hidden mt-1">
                    <MDEditor
                      value={formData.content_de}
                      onChange={(value: string | undefined) => setFormData(prev => ({ ...prev, content_de: value || "" }))}
                      height={200}
                      preview="edit"
                      hideToolbar={false}
                      visibleDragbar={false}
                    />
                  </div>
                </div>
                <div>
                  <span className="text-xs text-slate-500 font-medium">İngilizce</span>
                  <div className="border border-slate-300 rounded-lg overflow-hidden mt-1">
                    <MDEditor
                      value={formData.content_en}
                      onChange={(value: string | undefined) => setFormData(prev => ({ ...prev, content_en: value || "" }))}
                      height={200}
                      preview="edit"
                      hideToolbar={false}
                      visibleDragbar={false}
                    />
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Markdown formatında yazabilirsiniz. **kalın**, *italik*, [link](url), #başlık vb.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_published"
                checked={formData.is_published}
                onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="is_published" className="text-sm text-slate-700">
                Yayında
              </label>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
              >
                {editingNews ? "Güncelle" : "Kaydet"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors"
              >
                İptal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Haber Listesi */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {news.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-16 w-16 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">Henüz haber bulunmamaktadır.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left p-4 font-medium text-slate-700">Başlık</th>
                  <th className="text-left p-4 font-medium text-slate-700">Durum</th>
                  <th className="text-left p-4 font-medium text-slate-700">Tarih</th>
                  <th className="text-right p-4 font-medium text-slate-700">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {news.map((newsItem) => (
                  <tr key={newsItem.id} className="hover:bg-slate-50">
                    <td className="p-4">
                      <div>
                        <div className="font-medium text-slate-900">{newsItem.title}</div>
                        {newsItem.summary && (
                          <div className="text-sm text-slate-500 mt-1 line-clamp-1">
                            {newsItem.summary}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        newsItem.is_published
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-700"
                      }`}>
                        {newsItem.is_published ? (
                          <>
                            <Eye className="h-3 w-3" />
                            Yayında
                          </>
                        ) : (
                          <>
                            <EyeOff className="h-3 w-3" />
                            Taslak
                          </>
                        )}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-slate-600">
                      {new Date(newsItem.created_at).toLocaleDateString("tr-TR")}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => togglePublish(newsItem.id, newsItem.is_published)}
                          className="p-1 text-slate-600 hover:text-primary-600 transition-colors"
                          title={newsItem.is_published ? "Yayından kaldır" : "Yayınla"}
                        >
                          {newsItem.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => handleEdit(newsItem)}
                          className="p-1 text-slate-600 hover:text-primary-600 transition-colors"
                          title="Düzenle"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(newsItem.id)}
                          className="p-1 text-slate-600 hover:text-red-600 transition-colors"
                          title="Sil"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
    </AdminOnlyGuard>
  );
}
