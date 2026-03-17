"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";

/**
 * /bilgilendirme ana sayfa → /bilgilendirme/sss yönlendirmesi.
 * Config redirect'ler locale'li path'leri zaten yönlendirir; bu fallback (örn. middleware sonrası gelen istekler için).
 */
export default function BilgilendirmeIndexPage() {
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    router.replace(`/${locale}/bilgilendirme/sss`);
  }, [router, locale]);

  return null;
}
