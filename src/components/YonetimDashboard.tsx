"use client";

import Link from "next/link";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import OrganizerDashboard from "@/components/OrganizerDashboard";

export default function YonetimDashboard() {
  const { isAdmin, isController, isOrganizer } = useSimpleAuth();

  if (isOrganizer) {
    return <OrganizerDashboard />;
  }

  if (isController) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Kontrolör Paneli</h2>
        <p className="text-slate-600 mb-6">
          Bilet doğrulama sayfasından biletleri kontrol edebilirsiniz.
        </p>
        <Link
          href="/yonetim/bilet-kontrol"
          className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors"
        >
          Bilet Kontrol →
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
      <h2 className="text-xl font-semibold text-slate-900 mb-4">Yönetim Paneline Hoş Geldiniz</h2>
      <p className="text-slate-600 mb-6">Sol menüden istediğiniz sayfaya erişebilirsiniz.</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/yonetim/etkinlikler" className="p-4 border border-slate-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors group">
          <h3 className="font-medium text-slate-900 group-hover:text-primary-700">Etkinlikler</h3>
          <p className="text-sm text-slate-500">Tüm etkinlikleri yönetin</p>
        </Link>
        <Link href="/yonetim/mekanlar" className="p-4 border border-slate-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors group">
          <h3 className="font-medium text-slate-900 group-hover:text-primary-700">Mekanlar / Salon ayarları</h3>
          <p className="text-sm text-slate-500">Mekanlar ve oturum planı (bölüm, sıra, koltuk)</p>
        </Link>
        <Link href="/yonetim/salon-yapim-wizard" className="p-4 border border-slate-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors group">
          <h3 className="font-medium text-slate-900 group-hover:text-primary-700">Salon Yapım Wizard</h3>
          <p className="text-sm text-slate-500">Adım adım salon planı oluşturun</p>
        </Link>
        <Link href="/yonetim/haberler" className="p-4 border border-slate-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors group">
          <h3 className="font-medium text-slate-900 group-hover:text-primary-700">Haberler</h3>
          <p className="text-sm text-slate-500">Haberleri yönetin ve yayınlayın</p>
        </Link>
        <Link href="/yonetim/bilet-kontrol" className="p-4 border border-slate-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors group">
          <h3 className="font-medium text-slate-900 group-hover:text-primary-700">Bilet Kontrol</h3>
          <p className="text-sm text-slate-500">Biletleri doğrulayın</p>
        </Link>
        <Link href="/yonetim/muhasebe" className="p-4 border border-slate-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors group">
          <h3 className="font-medium text-slate-900 group-hover:text-primary-700">Muhasebe</h3>
          <p className="text-sm text-slate-500">Finansal raporlar</p>
        </Link>
        <Link href="/yonetim/etkinlik-uyarilari" className="p-4 border border-slate-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors group">
          <h3 className="font-medium text-slate-900 group-hover:text-primary-700">Etkinlik Uyarıları</h3>
          <p className="text-sm text-slate-500">Bilet hatırlatması kayıtları</p>
        </Link>
        <Link href="/yonetim/huni-analitigi" className="p-4 border border-slate-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors group">
          <h3 className="font-medium text-slate-900 group-hover:text-primary-700">Huni Analitiği</h3>
          <p className="text-sm text-slate-500">Görüntüleme → Satın alma</p>
        </Link>
        <Link href="/yonetim/kullanicilar" className="p-4 border border-slate-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors group">
          <h3 className="font-medium text-slate-900 group-hover:text-primary-700">Kullanıcılar</h3>
          <p className="text-sm text-slate-500">Rol ve yetki yönetimi</p>
        </Link>
        <Link href="/yonetim/bilet-turleri" className="p-4 border border-slate-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors group">
          <h3 className="font-medium text-slate-900 group-hover:text-primary-700">Bilet Türleri</h3>
          <p className="text-sm text-slate-500">Bilet kategorileri</p>
        </Link>
        <Link href="/yonetim/siparisler" className="p-4 border border-slate-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors group">
          <h3 className="font-medium text-slate-900 group-hover:text-primary-700">Siparişler</h3>
          <p className="text-sm text-slate-500">Bilet siparişleri</p>
        </Link>
        <Link href="/yonetim/bilet-listesi" className="p-4 border border-slate-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors group">
          <h3 className="font-medium text-slate-900 group-hover:text-primary-700">Bilet Listesi</h3>
          <p className="text-sm text-slate-500">Satılan biletler</p>
        </Link>
        <Link href="/yonetim/slider-yonetimi" className="p-4 border border-slate-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors group">
          <h3 className="font-medium text-slate-900 group-hover:text-primary-700">Slider</h3>
          <p className="text-sm text-slate-500">Ana ve haber slider</p>
        </Link>
        <Link href="/yonetim/sanatcilar" className="p-4 border border-slate-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors group">
          <h3 className="font-medium text-slate-900 group-hover:text-primary-700">Sanatçılar</h3>
          <p className="text-sm text-slate-500">Özgeçmiş ve galeri düzenleyin</p>
        </Link>
        <Link href="/yonetim/hero-backgrounds" className="p-4 border border-slate-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors group">
          <h3 className="font-medium text-slate-900 group-hover:text-primary-700">Hero Background</h3>
          <p className="text-sm text-slate-500">Ana sayfa arka planı</p>
        </Link>
        <Link href="/yonetim/sehirler" className="p-4 border border-slate-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors group">
          <h3 className="font-medium text-slate-900 group-hover:text-primary-700">Şehirler</h3>
          <p className="text-sm text-slate-500">Das ist los in deiner Stadt!</p>
        </Link>
        <Link href="/yonetim/ayarlar" className="p-4 border border-slate-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors group">
          <h3 className="font-medium text-slate-900 group-hover:text-primary-700">Ayarlar</h3>
          <p className="text-sm text-slate-500">Sistem ayarları</p>
        </Link>
      </div>
      <div className="mt-8 pt-8 border-t border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Hızlı Ekleme</h3>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/yonetim/etkinlikler?yeni=true" className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors">
            <span className="text-lg">+</span> Yeni Etkinlik
          </Link>
          <Link href="/yonetim/haberler?yeni=true" className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
            <span className="text-lg">+</span> Yeni Haber
          </Link>
          <Link href="/yonetim/sanatcilar" className="inline-flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
            <span className="text-lg">+</span> Yeni Sanatçı
          </Link>
          <Link href="/yonetim/slider-yonetimi?yeni=true" className="inline-flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors">
            <span className="text-lg">+</span> Yeni slider kartı
          </Link>
        </div>
      </div>
    </div>
  );
}
