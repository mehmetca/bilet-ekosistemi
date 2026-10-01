"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";

export default function ControlGuidePage() {
  const { user, loading, isAdmin, isController, isOrganizer } = useSimpleAuth();
  const router = useRouter();
  const canAccess = isAdmin || isController || isOrganizer;

  useEffect(() => {
    if (loading || user) return;
    const redirect = "/kontrol/kullanim-klavuzu";
    router.replace(`/giris?redirect=${encodeURIComponent(redirect)}`);
  }, [loading, router, user]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-600">
        Oturum kontrol ediliyor...
      </main>
    );
  }

  if (!canAccess) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-slate-900">Erişim yetkiniz yok</h1>
          <p className="mt-2 text-slate-600">Bu kılavuz yalnızca yetkili kontrol personeli içindir.</p>
          <Link href="/" className="mt-4 inline-block text-primary-700 underline">Ana sayfaya dön</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-900">Bilet Kontrol Kullanım Kılavuzu</h1>
          <Link
            href="/kontrol"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Bilet kontrole dön
          </Link>
        </div>

        <p className="mb-6 rounded-lg border border-slate-200 bg-white p-4 text-slate-700">
          Bilet sahibi biletini basılı olarak veya telefonundan gösterdiğinde QR kodu okutun. Yeşil sonuç biletin geçerli olduğunu gösterir; girişi tamamlamak için mutlaka “Giriş işaretle” düğmesine basın. Kırmızı sonuçta bileti kabul etmeyin.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <GuideStep
            title="1. QR kodunu okutun"
            image="/images/controller-guide/step-1.png"
            alt="QR kod tarama ekranı"
            description="Bilet kontrol ekranında Kamera ile Tara seçeneğini açıp QR kodu telefon kamerasına gösterin. Kamera izni için siteyi HTTPS üzerinden açın."
          />
          <GuideStep
            title="2. Yeşil kartı doğrulayın"
            image="/images/controller-guide/step-2.png"
            alt="Geçerli bilet sonucu"
            description="Etkinlik ve bilet bilgilerini kontrol edin. Bilet geçerliyse Giriş işaretle düğmesine basın."
          />
          <GuideStep
            title="3. Giriş onayını bekleyin"
            image="/images/controller-guide/step-3.png"
            alt="Giriş işaretlendi onayı"
            description="Giriş işaretlendi onayını görmeden işlemi tamamlanmış saymayın. Sonraki bilet için kontrol ekranına dönün."
          />
          <GuideStep
            title="4. Kırmızı kartta giriş vermeyin"
            image="/images/controller-guide/step-4.png"
            alt="Kullanılmış veya geçersiz bilet sonucu"
            description="Bilet bulunamadı, geçersiz veya daha önce kullanılmış uyarısı varsa bileti kabul etmeyin; gerekirse sorumlu kişiye danışın."
          />
        </div>
      </div>
    </main>
  );
}

function GuideStep({
  title,
  image,
  alt,
  description,
}: {
  title: string;
  image: string;
  alt: string;
  description: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">{title}</h2>
      <div className="overflow-hidden rounded-md border border-slate-200">
        <Image src={image} alt={alt} width={420} height={760} className="h-auto w-full" />
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-700">{description}</p>
    </section>
  );
}