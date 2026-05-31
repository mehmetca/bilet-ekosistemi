import Image from "next/image";
import { resolvePublicImageUrl } from "@/lib/external-image";

type HomeHeroLcpProps = {
  imageUrl: string | null | undefined;
  alt: string;
};

/**
 * LCP görseli Next Image ile optimize edilir; büyük Supabase PNG'leri
 * viewport boyutuna göre yeniden boyutlandırılıp modern formata çevrilir.
 */
export default function HomeHeroLcp({ imageUrl, alt }: HomeHeroLcpProps) {
  const src = resolvePublicImageUrl(imageUrl);
  if (!src) return null;

  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority
      quality={70}
      sizes="100vw"
      className="hero-lcp-img z-0 object-cover"
    />
  );
}
