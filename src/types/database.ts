export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  venue: string;
  venue_id?: string | null;
  price_from: number;
  image_url?: string;
  category: EventCategory;
  is_active: boolean;
  slug?: string;
  ticket_url?: string | null;
  created_at: string;
  updated_at: string;
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
  entrance_info: string | null;
  transport_info: string | null;
  map_embed_url: string | null;
  rules: string | null;
  faq: Array<{ soru: string; cevap: string }>;
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
  | 'sinema' 
  | 'festival' 
  | 'spor' 
  | 'stand-up' 
  | 'diger';

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  konser: 'Konser',
  tiyatro: 'Tiyatro',
  sinema: 'Sinema',
  festival: 'Festival',
  spor: 'Spor',
  'stand-up': 'Stand-Up',
  diger: 'Diğer',
};

/** Ana sayfa filtre ve etkinlik formunda gösterilecek kategoriler (spor çıkarıldı) */
export const DISPLAY_CATEGORIES: EventCategory[] = ['konser', 'tiyatro', 'stand-up', 'festival', 'diger'];

export const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  normal: "Normal",
  vip: "VIP",
};
