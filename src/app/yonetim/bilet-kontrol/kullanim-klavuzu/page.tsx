"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function BiletKontrolKullanimKlavuzuPage() {
  return (
    <div className="p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Bilet Kontrol Kullanım Kılavuzu</h1>
          <Link
            href="/yonetim/bilet-kontrol"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Bilet Kontrole Dön
          </Link>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-slate-700">
            Bilet kontrolörü olarak görev almış bulunmaktasınız. Bilet sahibi biletini basılı olarak veya telefonundan gösterdiğinde, QR kodu
            kendi telefonunuzdan okutulur ve sonuç bu ekranda görülür. Aşağıdaki fotoğraflar gerçek akışı gösterir.
          </p>
        </div>

        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-2 text-sm font-semibold text-slate-900">1) QR kodu kamera ile okutun</div>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <Image
                  src="/images/controller-guide/step-1.png"
                  alt="QR kod tarama popup ekranı"
                  width={420}
                  height={760}
                  className="h-auto w-full"
                  priority
                />
              </div>
              <p className="mt-2 text-xs text-slate-700">
                <code>Bilet Tara</code> butonuna basın; kamera açılır açılmaz tarama başlar ve ardışık biletler için açık kalır. Giriş yoksa önce login ekranı açılır.
              </p>
            </div>

            <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
              <div className="mb-2 text-sm font-semibold text-green-900">2) Yeşil kart: geçerli bilet</div>
              <div className="overflow-hidden rounded-xl border border-green-200 bg-white">
                <Image
                  src="/images/controller-guide/step-2.png"
                  alt="Geçerli bilet yeşil sonuç kartı"
                  width={420}
                  height={760}
                  className="h-auto w-full"
                />
              </div>
              <p className="mt-2 text-xs text-green-900">
                Kapıda (<code>/kontrol</code>) ve bu panelde okutmak yalnız doğrular; bilet kullanılmış olmaz. Kartta <code>Geçerli bilet — onay bekliyor</code> yazar ve altında <code>Giriş işaretle</code> butonu durur.
              </p>
            </div>

            <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
              <div className="mb-2 text-sm font-semibold text-green-900">3) "Giriş işaretle" düğmesine basın</div>
              <div className="overflow-hidden rounded-xl border border-green-200 bg-white">
                <Image
                  src="/images/controller-guide/step-3.png"
                  alt="Giriş işaretlendi onay ekranı"
                  width={420}
                  height={760}
                  className="h-auto w-full"
                />
              </div>
              <p className="mt-2 text-xs text-green-900">
                Bilet sahibi içeri geçecekse bu düğmeye basın; <code>Giriş işaretlendi</code> mesajını görmeden işlemi tamamlanmış saymayın. Deneme amaçlı okutmalarda basmayın, bilet sahibi sonra içeri giremez.
              </p>
            </div>

            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="mb-2 text-sm font-semibold text-red-900">4) Kırmızı kart: içeri almayın</div>
              <div className="overflow-hidden rounded-xl border border-red-200 bg-white">
                <Image
                  src="/images/controller-guide/step-4.png"
                  alt="Kullanılmış veya geçersiz bilet kırmızı sonuç kartı"
                  width={420}
                  height={760}
                  className="h-auto w-full"
                />
              </div>
              <p className="mt-2 text-xs text-red-900">
                Kapıda kırmızı <code>Bu bilet içeri geçti.</code> yazıyorsa bilet daha önce okutulmuştur; ziyaretçiyi nazik şekilde içeri almayın.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

