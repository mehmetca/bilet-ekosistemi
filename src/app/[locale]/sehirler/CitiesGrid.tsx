"use client";

import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { MapPin } from "lucide-react";

interface City {
  id: string;
  slug: string;
  name_tr?: string | null;
  name_de?: string | null;
  name_en?: string | null;
  image_url?: string | null;
}

export default function CitiesGrid({ cities }: { cities: City[] }) {
  const locale = useLocale() as "tr" | "de" | "en";
  const t = useTranslations("cities");

  if (cities.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
        <MapPin className="mx-auto mb-4 h-16 w-16 text-slate-300" />
        <p className="text-slate-600">{t("noCities")}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {cities.map((city) => {
        const name = (locale === "de" ? city.name_de : locale === "en" ? city.name_en : city.name_tr) || city.name_tr || city.name_de || city.name_en || city.slug;
        return (
          <Link
            key={city.id}
            href={`/city/${city.slug}`}
            className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-lg hover:border-primary-200"
          >
            <div className="aspect-[16/9] overflow-hidden bg-slate-100">
              {city.image_url ? (
                <img
                  src={city.image_url}
                  alt={name}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-100 to-primary-50">
                  <MapPin className="h-12 w-12 text-primary-400" />
                </div>
              )}
            </div>
            <div className="py-3 text-center">
              <h3 className="font-semibold text-slate-900 group-hover:text-primary-600">{name}</h3>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
