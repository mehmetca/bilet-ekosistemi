import type { Metadata } from "next";
import type { Artist } from "@/types/database";
import { createServerSupabase } from "@/lib/supabase-server";
import { parseArtistBio } from "@/lib/artistProfile";
import { getLocalizedArtist, type Locale } from "@/lib/i18n-content";
import { getSiteUrl } from "@/lib/site-url";
import { routing } from "@/i18n/routing";
import ArtistPageClient from "./ArtistPageClient";

interface PageProps {
  params: Promise<{ locale?: string; slug: string }>;
}

function getYouTubeEmbedUrl(url?: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace("www.", "");
    let videoId = "";

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname === "/watch") {
        videoId = parsed.searchParams.get("v") || "";
      } else if (parsed.pathname.startsWith("/shorts/")) {
        videoId = parsed.pathname.split("/")[2] || "";
      } else if (parsed.pathname.startsWith("/embed/")) {
        videoId = parsed.pathname.split("/")[2] || "";
      }
    } else if (host === "youtu.be") {
      videoId = parsed.pathname.replace("/", "");
    }

    if (!videoId) return null;
    return `https://www.youtube.com/embed/${videoId}`;
  } catch {
    return null;
  }
}

function getYouTubeVideoId(url?: string): string | null {
  const embed = getYouTubeEmbedUrl(url);
  if (!embed) return null;
  return embed.split("/embed/")[1] || null;
}

async function getArtistBySlug(slug: string): Promise<Artist | null> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase.from("artists").select("*").eq("slug", slug).maybeSingle();
  if (error || !data) return null;
  return data as Artist;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, locale: localeParam } = await params;
  const locale = (localeParam && routing.locales.includes(localeParam as Locale)
    ? localeParam
    : routing.defaultLocale) as Locale;
  const artist = await getArtistBySlug(slug);
  if (!artist) {
    return {
      title: "Sanatci bulunamadi | KurdEvents",
      robots: { index: false, follow: true },
    };
  }

  const localized = getLocalizedArtist(artist as unknown as Record<string, unknown>, locale);
  const parsed = parseArtistBio(localized.bio || artist.bio);
  const title = `${localized.name || artist.name} | KurdEvents`;
  const description = (parsed.content || artist.bio || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  const base = getSiteUrl();
  const path = `/sanatci/${slug}`;
  const canonical = `${base}/${locale}${path}`;
  const languages: Record<string, string> = {};
  for (const l of routing.locales) {
    languages[l] = `${base}/${l}${path}`;
  }
  languages["x-default"] = `${base}/${routing.defaultLocale}${path}`;

  return {
    title,
    description: description || `${localized.name || artist.name} sanatci profili ve videolari.`,
    alternates: { canonical, languages },
    openGraph: {
      title,
      description: description || `${localized.name || artist.name} sanatci profili.`,
      url: canonical,
      type: "profile",
      siteName: "KurdEvents",
      images: artist.image_url ? [{ url: artist.image_url, width: 1200, height: 630, alt: artist.name }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: description || `${localized.name || artist.name} sanatci profili.`,
      images: artist.image_url ? [artist.image_url] : undefined,
    },
  };
}

export default async function ArtistPage({ params }: PageProps) {
  const { slug, locale = routing.defaultLocale } = await params;
  const artist = await getArtistBySlug(slug);

  let videoJsonLd: Array<Record<string, unknown>> = [];
  if (artist) {
    const localized = getLocalizedArtist(artist as unknown as Record<string, unknown>, locale as Locale);
    const parsed = parseArtistBio(localized.bio || artist.bio);
    const embedUrls = parsed.videoUrls
      .map((url) => getYouTubeEmbedUrl(url))
      .filter(Boolean) as string[];

    videoJsonLd = embedUrls.map((embedUrl, index) => {
      const videoId = getYouTubeVideoId(embedUrl);
      const thumb = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined;
      return {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        name: `${localized.name || artist.name} video ${index + 1}`,
        description: `${localized.name || artist.name} sanatci videosu`,
        embedUrl,
        thumbnailUrl: thumb ? [thumb] : undefined,
        publisher: {
          "@type": "Organization",
          name: "KurdEvents",
        },
      };
    });
  }

  return (
    <>
      {videoJsonLd.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(videoJsonLd) }}
        />
      )}
      <ArtistPageClient artist={artist} slug={slug} />
    </>
  );
}
