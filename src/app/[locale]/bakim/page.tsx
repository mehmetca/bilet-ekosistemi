import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { getMaintenanceModeCached } from "@/lib/maintenance-mode";

const COPY: Record<string, { title: string; body: string }> = {
  tr: {
    title: "Bakım çalışması",
    body: "Sitemiz şu anda kısa bir bakım nedeniyle geçici olarak kapalı. Lütfen daha sonra tekrar deneyin.",
  },
  de: {
    title: "Wartungsarbeiten",
    body: "Unsere Website ist aufgrund kurzer Wartungsarbeiten vorübergehend nicht erreichbar. Bitte versuchen Sie es später erneut.",
  },
  en: {
    title: "Under maintenance",
    body: "Our site is temporarily unavailable due to scheduled maintenance. Please try again later.",
  },
  ku: {
    title: "Xebata lênêrînê",
    body: "Malpera me ji ber lênêrîna kurt demkî girtî ye. Ji kerema xwe paşê dîsa biceribînin.",
  },
  ckb: {
    title: "کاری چاککردنەوە",
    body: "ماڵپەڕەکەمان ئێستا بەهۆی چاککردنەوەی کورت کاتی داخراوە. تکایە دواتر هەوڵ بدەنەوە.",
  },
};

export default async function BakimPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const resolved = await params;
  const locale = resolved?.locale || routing.defaultLocale;
  setRequestLocale(locale);

  const enabled = await getMaintenanceModeCached();
  if (!enabled) {
    redirect(`/${locale}`);
  }

  const copy = COPY[locale] || COPY.tr;

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-lg w-full text-center space-y-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">KurdEvents</p>
        <h1 className="text-3xl font-bold text-slate-900">{copy.title}</h1>
        <p className="text-slate-600 leading-relaxed">{copy.body}</p>
      </div>
    </main>
  );
}
