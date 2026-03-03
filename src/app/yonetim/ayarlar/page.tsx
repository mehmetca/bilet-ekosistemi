"use client";

import { useState } from "react";
import { Settings, Save, Database, Shield, Bell } from "lucide-react";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";

export default function AyarlarPage() {
  const { isAdmin } = useSimpleAuth();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    siteName: "Bilet Ekosistemi",
    siteDescription: "Modern bilet satış platformu",
    contactEmail: "info@bilet-ekosistemi.com",
    maxTicketQuantity: 10,
    enableNotifications: true,
    maintenanceMode: false
  });

  // Sadece admin erişebilir
  if (!isAdmin) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <Settings className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-red-800 mb-2">
            Erişim Reddedildi
          </h2>
          <p className="text-red-600">
            Bu sayfaya sadece yöneticiler erişebilir.
          </p>
        </div>
      </div>
    );
  }

  async function handleSave() {
    setLoading(true);
    try {
      // Burada ayarları kaydetme işlemi yapılacak
      // Şimdilik sadece gösterim amaçlı
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert("Ayarlar başarıyla kaydedildi!");
    } catch (error) {
      console.error("Settings save error:", error);
      alert("Ayarlar kaydedilemedi. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Sistem Ayarları
        </h1>
        <p className="text-slate-600 mb-8">
          Sistem genel ayarlarını yapılandırın.
        </p>

        <div className="space-y-6">
          {/* Genel Ayarlar */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Database className="h-5 w-5 text-slate-600" />
              Genel Ayarlar
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Site Adı
                </label>
                <input
                  type="text"
                  value={settings.siteName}
                  onChange={(e) => setSettings({...settings, siteName: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Site Açıklaması
                </label>
                <textarea
                  value={settings.siteDescription}
                  onChange={(e) => setSettings({...settings, siteDescription: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  İletişim E-postası
                </label>
                <input
                  type="email"
                  value={settings.contactEmail}
                  onChange={(e) => setSettings({...settings, contactEmail: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Maksimum Bilet Adedi
                </label>
                <input
                  type="number"
                  value={settings.maxTicketQuantity}
                  onChange={(e) => setSettings({...settings, maxTicketQuantity: parseInt(e.target.value)})}
                  min="1"
                  max="20"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Bildirim Ayarları */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Bell className="h-5 w-5 text-slate-600" />
              Bildirim Ayarları
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-900">Bildirimleri Etkinleştir</div>
                  <div className="text-sm text-slate-500">
                    Yeni sipariş ve sistem bildirimleri
                  </div>
                </div>
                <button
                  onClick={() => setSettings({...settings, enableNotifications: !settings.enableNotifications})}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.enableNotifications ? 'bg-primary-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.enableNotifications ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-900">Bakım Modu</div>
                  <div className="text-sm text-slate-500">
                    Siteyi bakım için geçici olarak kapat
                  </div>
                </div>
                <button
                  onClick={() => setSettings({...settings, maintenanceMode: !settings.maintenanceMode})}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.maintenanceMode ? 'bg-red-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.maintenanceMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Güvenlik Ayarları */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-slate-600" />
              Güvenlik Ayarları
            </h3>
            
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="font-medium text-slate-900 mb-2">Oturum Süresi</div>
                <div className="text-sm text-slate-600">
                  Kullanıcı oturumları 24 saat sonra otomatik olarak sonlandırılır.
                </div>
              </div>
              
              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="font-medium text-slate-900 mb-2">Şifre Politikası</div>
                <div className="text-sm text-slate-600">
                  Minimum 8 karakter, en az bir büyük harf ve bir rakam içermelidir.
                </div>
              </div>
            </div>
          </div>

          {/* Kaydet Butonu */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="h-4 w-4" />
              {loading ? "Kaydediliyor..." : "Ayarları Kaydet"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
