/** Sepet + koltuk tutma süresi (ms). Her sepete eklemede süre yenilenir. (Metin: messages → checkout.reservationExpired*) */
export const CART_RESERVATION_MS = 10 * 60 * 1000;

export const CART_RESERVATION_SECONDS = Math.round(CART_RESERVATION_MS / 1000);

/** localStorage: sepet rezervasyonunun bittiği an (epoch ms) */
export const CART_EXPIRY_KEY = "bilet_ekosistemi_cart_expires_at";

export const CART_EXPIRED_FLAG_KEY = "bilet_cart_expired";

/** sessionStorage: süre dolunca son sepetteki ilk etkinlik (etkinlik sayfasına dönüş için) */
export const CART_EXPIRED_SNAPSHOT_KEY = "bilet_cart_expired_snapshot";

export type CartExpiredSnapshot = {
  eventId: string;
  eventTitle: string;
  imageUrl?: string;
  venue: string;
  location: string;
  eventDate: string;
  eventTime: string;
};
