"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import { useLocale, useTranslations } from "next-intl";
import { supabase } from "@/lib/supabase-client";
import { parseArtistBio } from "@/lib/artistProfile";
import { getLocalizedArtist } from "@/lib/i18n-content";
import type { Artist } from "@/types/database";

const PAGE_SIZE = 30;
const LETTERS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
];

function stripMarkdown(value: string): string {
  return value
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[[^\]]+\]\([^)]+\)/g, "")
    .replace(/[#*_>`~-]/g, "")
    .replace(/\n+/g, " ")
    .trim();
}

function getLineClampClass(lines: number): string {
  switch (lines) {
    case 1:
      return "line-clamp-1";
    case 2:
      return "line-clamp-2";
    case 4:
      return "line-clamp-4";
    case 5:
      return "line-clamp-5";
    case 6:
      return "line-clamp-6";
    case 3:
    default:
      return "line-clamp-3";
  }
}

function SanatciIndexContent() {
  const t = useTranslations("artists");
  const locale = useLocale() as "tr" | "de" | "en";
  const router = useRouter();
  const searchParams = useSearchParams();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [selectedLetter, setSelectedLetter] = useState((searchParams.get("letter") || "all").toUpperCase());

  const page = Math.max(1, Number(searchParams.get("page") || "1"));

  const filteredArtists = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase("tr");
    return artists.filter((artist) => {
      const localized = getLocalizedArtist(artist as unknown as Record<string, unknown>, locale);
      const name = (localized.name || artist.name || "").trim();
      const normalizedName = name.toLocaleUpperCase("tr");
      const firstLetter = normalizedName.charAt(0);
      const matchesLetter = selectedLetter === "ALL" || firstLetter === selectedLetter;
      const matchesSearch = !term || name.toLocaleLowerCase("tr").includes(term);
      return matchesLetter && matchesSearch;
    });
  }, [artists, locale, searchTerm, selectedLetter]);

  const totalPages = Math.max(1, Math.ceil(filteredArtists.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const pagedArtists = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredArtists.slice(start, start + PAGE_SIZE);
  }, [filteredArtists, currentPage]);

  useEffect(() => {
    async function fetchArtists() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("artists")
          .select("*")
          .or("show_on_artist_page.is.null,show_on_artist_page.eq.true")
          .order("name", { ascending: true });

        if (error) {
          console.error("Artists fetch error:", error);
          setArtists([]);
          return;
        }

        setArtists((data || []) as Artist[]);
      } catch (error) {
        console.error("Artists fetch exception:", error);
        setArtists([]);
      } finally {
        setLoading(false);
      }
    }

    fetchArtists();
  }, []);

  function goToPage(nextPage: number) {
    const target = Math.min(Math.max(1, nextPage), totalPages);
    const params = new URLSearchParams();
    params.set("page", String(target));
    if (searchTerm.trim()) params.set("q", searchTerm.trim());
    if (selectedLetter !== "ALL") params.set("letter", selectedLetter);
    router.push(`/sanatci?${params.toString()}`);
  }

  function applyFilters(nextSearchTerm: string, nextLetter: string) {
    const params = new URLSearchParams();
    params.set("page", "1");
    if (nextSearchTerm.trim()) params.set("q", nextSearchTerm.trim());
    if (nextLetter !== "ALL") params.set("letter", nextLetter);
    router.push(`/sanatci?${params.toString()}`);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="container mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="page-title">{t("title")}</h1>
          <p className="body-muted mt-2">{t("subtitle")}</p>
        </div>

        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3">
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => {
                const value = e.target.value;
                setSearchTerm(value);
                applyFilters(value, selectedLetter);
              }}
              placeholder={locale === "de" ? "Kunstler suchen..." : locale === "en" ? "Search artists..." : "Sanatci ara..."}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:ring-primary-500"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedLetter("ALL");
                  applyFilters(searchTerm, "ALL");
                }}
                className={`h-8 rounded-md px-2 text-xs font-semibold ${
                  selectedLetter === "ALL"
                    ? "bg-primary-600 text-white"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Tümü
              </button>
              {LETTERS.map((letter) => (
                <button
                  key={letter}
                  type="button"
                  onClick={() => {
                    setSelectedLetter(letter);
                    applyFilters(searchTerm, letter);
                  }}
                  className={`h-8 min-w-8 rounded-md px-2 text-xs font-semibold ${
                    selectedLetter === letter
                      ? "bg-primary-600 text-white"
                      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
            {t("loading")}
          </div>
        ) : pagedArtists.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
            {t("noArtists")}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {pagedArtists.map((artist) => {
                const localized = getLocalizedArtist(artist as unknown as Record<string, unknown>, locale);
                const parsed = parseArtistBio(localized.bio || artist.bio);
                const excerpt =
                  parsed.cardText.trim() || stripMarkdown(parsed.content).slice(0, 140);
                const lineClampClass = getLineClampClass(parsed.cardLines || 3);
                return (
                  <Link
                    key={artist.id}
                    href={`/sanatci/${artist.slug}`}
                    className="group overflow-hidden rounded-tl-2xl rounded-br-2xl rounded-tr-none rounded-bl-none border-[3px] border-slate-300 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-slate-400 hover:shadow-lg"
                  >
                    <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                      {artist.image_url ? (
                        <img
                          src={artist.image_url}
                          alt={localized.name || artist.name}
                          className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-slate-400 text-sm">
                          {t("noPhoto")}
                        </div>
                      )}
                      </div>
                    <div className="px-5 pt-6 pb-5 text-center">
                      <h2 className="card-title line-clamp-1 group-hover:text-primary-700">
                        {localized.name || artist.name}
                      </h2>
                      <p className={`mt-3 text-sm text-slate-600 ${lineClampClass}`}>
                        {excerpt || t("bioPlaceholder")}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((n) => (
                  <button
                    key={n}
                    onClick={() => goToPage(n)}
                    className={`h-9 min-w-9 rounded-md px-3 text-sm ${
                      n === currentPage
                        ? "bg-primary-600 text-white"
                        : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function ArtistsLoadingFallback() {
  const t = useTranslations("artists");
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="container mx-auto px-4 py-10">
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
          {t("loading")}
        </div>
      </main>
    </div>
  );
}

export default function SanatciIndexPage() {
  return (
    <Suspense fallback={<ArtistsLoadingFallback />}>
      <SanatciIndexContent />
    </Suspense>
  );
}

