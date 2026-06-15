import { getVenuesList } from "@/lib/venues-server";
import MekanlarClient from "./MekanlarClient";

export const revalidate = 1800;

type VenueFaqItem = { soru: string; cevap: string };

function normalizeVenueRow(row: Record<string, unknown>) {
  return {
    ...row,
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    address: (row.address as string | null) || null,
    city: (row.city as string | null) || null,
    capacity: row.capacity != null ? Number(row.capacity) : null,
    seating_layout_description: (row.seating_layout_description as string | null) || null,
    seating_layout_image_url: (row.seating_layout_image_url as string | null) || null,
    image_url_1: (row.image_url_1 as string | null) || null,
    image_url_2: (row.image_url_2 as string | null) || null,
    image_url_3: (row.image_url_3 as string | null) || null,
    image_url_4: (row.image_url_4 as string | null) || null,
    image_url_5: (row.image_url_5 as string | null) || null,
    entrance_info: (row.entrance_info as string | null) || null,
    transport_info: (row.transport_info as string | null) || null,
    rules: (row.rules as string | null) || null,
    map_embed_url: (row.map_embed_url as string | null) || null,
    faq: Array.isArray(row.faq)
      ? (row.faq as VenueFaqItem[]).filter((x) => x?.soru && x?.cevap)
      : [],
  };
}

export default async function MekanlarPage() {
  const rows = await getVenuesList();
  const venues = rows.map((row) => normalizeVenueRow(row));
  return <MekanlarClient initialVenues={venues} />;
}
