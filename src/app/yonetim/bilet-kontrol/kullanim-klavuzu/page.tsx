"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle, QrCode, LogIn, Camera } from "lucide-react";

function GuideImagePlaceholder({ title, subtitle, tone }: { title: string; subtitle: string; tone: "green" | "red" | "blue" }) {
  const toneClass =
    tone === "green"
      ? "from-green-100 to-emerald-100 border-green-200 text-green-900"
      : tone === "red"
        ? "from-red-100 to-rose-100 border-red-200 text-red-900"
        : "from-blue-100 to-indigo-100 border-blue-200 text-blue-900";

  return (
    <div className={`rounded-xl border bg-gradient-to-br p-4 ${toneClass}`}>
      <div className="aspect-[16/10] w-full rounded-lg border border-white/60 bg-white/50 p-4">
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-2 text-xs opacity-80">{subtitle}</div>
      </div>
    </div>
  );
}

export default function BiletKontrolKullanimKlavuzuPage() {
  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Bilet Kontrol Kullanım Kılavuzu</h1>
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
            kendi telefonunuzdan okutulur ve sonuç bu ekranda görülür.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-2 flex items-center gap-2 text-slate-900 font-semibold">
              <LogIn className="h-5 w-5 text-blue-600" />
              1) Giriş Akışı
            </div>
            <p className="text-sm text-slate-700">
              Daha önce siteye giriş yaptıysanız direkt kontrol paneline gelirsiniz. Giriş yapılmamışsa QR okutunca giriş sayfasına yönlenirsiniz.
              Kullanıcı adı ve şifre ile tekrar giriş yaptıktan sonra bilet kontrol sayfasına dönerek işleme devam edin.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-2 flex items-center gap-2 text-slate-900 font-semibold">
              <Camera className="h-5 w-5 text-blue-600" />
              2) QR Okutma
            </div>
            <p className="text-sm text-slate-700">
              Bilet üzerindeki QR kodu okutulduğunda sonuç kartı açılır. Geçerli bilette kart yeşil görünür; geçersiz veya daha önce kullanılmış
              bilette kart kırmızı görünür.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <QrCode className="h-4 w-4" />
              Foto 1 - Kontrol Ekranı
            </div>
            <GuideImagePlaceholder title="QR okutma sonrası kontrol ekranı" subtitle="Bilet bilgileri burada görünür." tone="blue" />
          </div>
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Foto 3 - Geçerli Bilet
            </div>
            <GuideImagePlaceholder
              title="Yeşil kart: Geçerli bilet"
              subtitle="Mutlaka 'Giriş işaretle' butonuna basın ve 'Giriş işaretlendi' yazısını görün."
              tone="green"
            />
          </div>
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <XCircle className="h-4 w-4 text-red-600" />
              Foto 4 - Geçersiz/Kullanılmış
            </div>
            <GuideImagePlaceholder
              title="Kırmızı kart: Geçersiz veya kullanılmış"
              subtitle="Bu biletlerle gelen kişileri nazik bir şekilde içeri almayın."
              tone="red"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

