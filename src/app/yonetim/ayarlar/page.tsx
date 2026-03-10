"use client";

import { useState, useEffect } from "react";
import { Save, Database, Shield, Bell, Mail, CheckCircle, XCircle } from "lucide-react";
import AdminOnlyGuard from "@/components/AdminOnlyGuard";
import { supabase } from "@/lib/supabase-client";

export default function AyarlarPage() {
  const [loading, setLoading] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{
    ready: boolean;
    checks: { RESEND_API_KEY: string; TICKET_EMAIL_FROM: string };
    message: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/email-status")
      .then((r) => r.json())
      .then(setEmailStatus)
      .catch(() => setEmailStatus(null));
  }, []);

  const [settings, setSettings] = useState({
    siteName: "Bilet Ekosistemi",
    siteDescription: "Modern bilet satış platformu",
    contactEmail: "info@bilet-ekosistemi.com",
    maxTicketQuantity: 10,
    enableNotifications: true,
    maintenanceMode: false
  });

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (typeof data?.maxTicketQuantity === "number") {
          setSettings((s) => ({ ...s, maxTicketQuantity: Math.max(1, Math.min(100, data.maxTicketQuantity)) }));
        }
      })
      .catch(() => {});
  }, []);

  async function handleSave() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        alert("Oturum açmanız gerekiyor.");
        return;
      }
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ maxTicketQuantity: settings.maxTicketQuantity }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json?.error || "Ayarlar kaydedilemedi.");
        return;
      }
      alert("Ayarlar başarıyla kaydedildi!");
    } catch (error) {
      console.error("Settings save error:", error);
      alert("Ayarlar kaydedilemedi. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminOnlyGuard>
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Sistem Ayarları
        </h1>
        <p className="text-slate-600 mb-8">
          Sistem genel ayarlarını yapılandırın.
        </p>

        <div className="space-y-6">
          {/* Bilet E-posta Yapılandırması */}
          {emailStatus && (
            <div
              className={`rounded-xl border p-6 ${
                emailStatus.ready
                  ? "border-green-200 bg-green-50"
                  : "border-amber-200 bg-amber-50"
              }`}
            >
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Mail className="h-5 w-5 text-slate-600" />
                Bilet E-postası
              </h3>
              <div className="flex items-start gap-3">
                {emailStatus.ready ? (
                  <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-medium text-slate-900">{emailStatus.message}</p>
                  <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-600">
                    <span>RESEND_API_KEY: {emailStatus.checks.RESEND_API_KEY}</span>
                    <span>TICKET_EMAIL_FROM: {emailStatus.checks.TICKET_EMAIL_FROM}</span>
                  </div>
                  {!emailStatus.ready && (
                    <p className="mt-2 text-sm text-slate-600">
                      Vercel / .env.local içinde bu değişkenleri tanımlayın. Resend hesabında gönderici
                      adresini doğrulayın.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

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
                  onChange={(e) => setSettings({...settings, maxTicketQuantity: Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1))})}
                  min={1}
                  max={100}
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
    </AdminOnlyGuard>
  );
}
