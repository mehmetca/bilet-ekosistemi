/**
 * [locale] altındaki statik, herkese açık yollar (sitemap için).
 * Dinamik sayfalar (etkinlik, haber, şehir detayı) ayrıca eklenebilir.
 */
export const SEO_SITEMAP_PATHS: string[] = [
  "",
  "/takvim",
  "/sehirler",
  "/mekanlar",
  "/sanatci",
  "/organizator-basvuru",
  /** Kanonik yol: kısa URL’ler ve `/bilgilendirme` yönlendirme hedefiyle aynı olsun (çift URL / canonical karmaşasını azaltır). */
  "/bilgilendirme/sss",
  "/bilgilendirme/veri-bilgisi",
  "/bilgilendirme/impressum",
  "/bilgilendirme/cerez-politikasi",
  "/bilgilendirme/mesafeli-satis-sozlesmesi",
  "/bilgilendirme/online-odeme-kosullari",
  "/bilgilendirme/iade-iptal-politikasi",
  "/bilgilendirme/kullanim-kosullari",
  "/bilgilendirme/b2b",
  "/bilgilendirme/organizator-destek",
];
