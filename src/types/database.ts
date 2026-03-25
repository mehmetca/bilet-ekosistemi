export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  /** Şehir (filtreleme ve kısa gösterim) */
  city?: string | null;
  /** Tam adres (detay sayfası) */
  address?: string | null;
  venue: string;
  venue_id?: string | null;
  price_from: number;
  /** Sepette / ödemede etkinlik başına en fazla bir kez uygulanan isteğe bağlı işlem ücreti (para birimi = currency). */
  checkout_processing_fee?: number | null;
  currency?: EventCurrency | null;
  image_url?: string;
  category: EventCategory;
  is_active: boolean;
  slug?: string;
  /** Tur/gösteri gruplaması - aynı show_slug'a sahip etkinlikler tek sayfada (Biletinial tarzı) */
  show_slug?: string | null;
  ticket_url?: string | null;
  created_at: string;
  updated_at: string;
  created_by_user_id?: string | null;
  /** Etkinlik sayfasında gösterilecek organizatör adı. Boşsa created_by_user_id üzerinden organizer_profiles'dan alınır. */
  organizer_display_name?: string | null;
  /** Çok dilli alanlar */
  title_tr?: string | null;
  title_de?: string | null;
  title_en?: string | null;
  description_tr?: string | null;
  description_de?: string | null;
  description_en?: string | null;
  venue_tr?: string | null;
  venue_de?: string | null;
  venue_en?: string | null;
  /** Oturum planı kullanılıyorsa "Yer seçerek bilet al" açılır (Faz 2) */
  seating_plan_id?: string | null;
  /** Ana sayfada öne çıkan etkinlik sırası (1 = sol, 2 = sağ). null = öne çıkan değil. */
  homepage_featured_order?: number | null;
}

export interface Venue {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  capacity: number | null;
  seating_layout_description: string | null;
  seating_layout_image_url: string | null;
  image_url_1?: string | null;
  image_url_2?: string | null;
  image_url_3?: string | null;
  image_url_4?: string | null;
  image_url_5?: string | null;
  entrance_info: string | null;
  transport_info: string | null;
  map_embed_url: string | null;
  rules: string | null;
  faq: Array<{ soru: string; cevap: string }>;
  /** Çok dilli alanlar */
  name_tr?: string | null;
  name_de?: string | null;
  name_en?: string | null;
  address_tr?: string | null;
  address_de?: string | null;
  address_en?: string | null;
  city_tr?: string | null;
  city_de?: string | null;
  city_en?: string | null;
  seating_layout_description_tr?: string | null;
  seating_layout_description_de?: string | null;
  seating_layout_description_en?: string | null;
  transport_info_tr?: string | null;
  transport_info_de?: string | null;
  transport_info_en?: string | null;
  entrance_info_tr?: string | null;
  entrance_info_de?: string | null;
  entrance_info_en?: string | null;
  rules_tr?: string | null;
  rules_de?: string | null;
  rules_en?: string | null;
}

/** Faz 2: Oturum planı – mekana bağlı */
export interface SeatingPlan {
  id: string;
  venue_id: string;
  name: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

/** Oturum planı bölümü (Blok A, Parket vb.) */
export interface SeatingPlanSection {
  id: string;
  seating_plan_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  /** Etkinlikteki bilet türü adı (Kategori 1, VIP vb.); koltuk seçiminde bu biletin fiyatı kullanılır */
  ticket_type_label?: string | null;
}

/** Bölümdeki sıra (row_label: "1", "A" vb.) */
export interface SeatingPlanRow {
  id: string;
  section_id: string;
  row_label: string;
  sort_order: number;
  created_at: string;
}

/** Koltuk (sıra + koltuk no; x,y görsel için opsiyonel) */
export interface Seat {
  id: string;
  row_id: string;
  seat_label: string;
  x?: number | null;
  y?: number | null;
  created_at: string;
}

export interface Artist {
  id: string;
  name: string;
  slug: string;
  tour_name?: string | null;
  image_url?: string | null;
  bio?: string | null;
  price_from?: number | null;
  tour_start_date?: string | null;
  tour_end_date?: string | null;
  created_at?: string;
  updated_at?: string;
  /** Çok dilli alanlar */
  name_tr?: string | null;
  name_de?: string | null;
  name_en?: string | null;
  bio_tr?: string | null;
  bio_de?: string | null;
  bio_en?: string | null;
}

export interface News {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  summary?: string;
  image_url?: string;
  is_published?: boolean;
  published_at: string;
  created_at: string;
  updated_at: string;
  /** Çok dilli alanlar */
  title_tr?: string | null;
  title_de?: string | null;
  title_en?: string | null;
  content_tr?: string | null;
  content_de?: string | null;
  content_en?: string | null;
  excerpt_tr?: string | null;
  excerpt_de?: string | null;
  excerpt_en?: string | null;
}

export interface Advertisement {
  id: string;
  title: string;
  image_url: string;
  link_url?: string;
  placement: string;
  is_active: boolean;
  sort_order?: number;
  created_at: string;
  updated_at: string;
}

export interface HeroBackground {
  id: string;
  title: string;
  image_url: string;
  placement: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  user_id?: string | null;
  event_id: string;
  ticket_id?: string | null;
  ticket_code?: string | null;
  quantity: number;
  total_price: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  payment_status?: 'pending' | 'paid' | 'failed';
  buyer_name?: string | null;
  buyer_email?: string | null;
  checked_at?: string | null;
  events?: { title?: string; date?: string; time?: string; venue?: string };
  tickets?: { name?: string; ticket_type?: string; price?: number };
  created_at: string;
  updated_at?: string;
}

export type TicketType = "normal" | "vip";

export interface Ticket {
  id: string;
  event_id: string;
  name: string;
  type: TicketType;
  // Backward compatibility for older payloads still using ticket_type.
  ticket_type?: TicketType;
  price: number;
  quantity: number;
  available: number;
  description?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  events?: {
    title?: string;
  };
}

export type EventCategory = 
  | 'konser' 
  | 'tiyatro' 
  | 'stand-up' 
  | 'festival' 
  | 'diger';

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  konser: 'Konser',
  tiyatro: 'Tiyatro',
  'stand-up': 'Stand-Up',
  festival: 'Festival',
  diger: 'Diğer',
};

export const DISPLAY_CATEGORIES: EventCategory[] = ['konser', 'tiyatro', 'stand-up', 'festival', 'diger'];

export type EventCurrency = 'EUR' | 'TL' | 'USD';

export const CURRENCY_SYMBOLS: Record<EventCurrency, string> = {
  EUR: '€',
  TL: '₺',
  USD: '$',
};

export const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  normal: "Normal",
  vip: "VIP",
};
