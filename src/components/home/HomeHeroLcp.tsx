import Image from "next/image";
import { resolvePublicImageUrl } from "@/lib/external-image";

type HomeHeroLcpProps = {
  imageUrl: string | null | undefined;
  alt: string;
};

/** Ana sayfa LCP görseli — Server Component; priority ile preload + Vercel optimizasyonu. */
export default function HomeHeroLcp({ imageUrl, alt }: HomeHeroLcpProps) {
  const src = resolvePublicImageUrl(imageUrl);
  if (!src) return null;

  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority
      sizes="100vw"
      className="hero-lcp-img object-cover"
    />
  );
}
