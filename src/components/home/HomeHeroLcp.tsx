import { resolvePublicImageUrl } from "@/lib/external-image";

type HomeHeroLcpProps = {
  imageUrl: string | null | undefined;
  alt: string;
};

/** Ana sayfa LCP görseli — Server Component; ilk HTML’de boyanır (client-only img değil). */
export default function HomeHeroLcp({ imageUrl, alt }: HomeHeroLcpProps) {
  const src = resolvePublicImageUrl(imageUrl);
  if (!src) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      fetchPriority="high"
      loading="eager"
      decoding="async"
      sizes="100vw"
      className="absolute inset-0 z-0 h-full w-full object-cover"
    />
  );
}
