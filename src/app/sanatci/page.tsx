"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import { supabase } from "@/lib/supabase-client";
import { parseArtistBio } from "@/lib/artistProfile";
import type { Artist } from "@/types/database";

const PAGE_SIZE = 30;

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);

  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const totalPages = Math.max(1, Math.ceil(artists.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const pagedArtists = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return artists.slice(start, start + PAGE_SIZE);
  }, [artists, currentPage]);

  useEffect(() => {
    async function fetchArtists() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("artists")
          .select("*")
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
    router.push(`/sanatci?page=${target}`);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="container mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Sanatçılar</h1>
          <p className="text-slate-600 mt-2">Tüm sanatçı biyografileri ve görselleri</p>
        </div>

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
            Yükleniyor...
          </div>
        ) : pagedArtists.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
            Henüz sanatçı kaydı yok.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
              {pagedArtists.map((artist) => {
                const parsed = parseArtistBio(artist.bio);
                const excerpt =
                  parsed.cardText.trim() || stripMarkdown(parsed.content).slice(0, 140);
                const lineClampClass = getLineClampClass(parsed.cardLines || 3);
                return (
                  <Link
                    key={artist.id}
                    href={`/sanatci/${artist.slug}`}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <div className="aspect-[4/3] bg-slate-100">
                      {artist.image_url ? (
                        <img
                          src={artist.image_url}
                          alt={artist.name}
                          className="h-full w-full object-cover object-top"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-slate-400 text-sm">
                          Fotoğraf yok
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h2 className="font-semibold text-slate-900 line-clamp-1">{artist.name}</h2>
                      <p className={`text-sm text-slate-600 mt-2 ${lineClampClass}`}>
                        {excerpt || "Biyografi bilgisi yakında eklenecek."}
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

export default function SanatciIndexPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50">
          <Header />
          <main className="container mx-auto px-4 py-10">
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
              Yükleniyor...
            </div>
          </main>
        </div>
      }
    >
      <SanatciIndexContent />
    </Suspense>
  );
}

