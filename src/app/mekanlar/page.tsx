"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { MapPin, Users, ChevronRight, Car, DoorOpen, HelpCircle } from "lucide-react";
import { supabase } from "@/lib/supabase-client";
import { extractMapEmbedUrl } from "@/lib/mapEmbed";

interface VenueFaqItem {
  soru: string;
  cevap: string;
}

interface Venue {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  capacity: number | null;
  seating_layout_description: string | null;
  seating_layout_image_url: string | null;
  entrance_info: string | null;
  transport_info: string | null;
  map_embed_url: string | null;
  rules: string | null;
  faq: VenueFaqItem[];
}

export default function MekanlarPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchVenues();
  }, []);

  async function fetchVenues() {
    try {
      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .order("city", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;

      setVenues(
        (data || []).map((row) => ({
          id: row.id,
          name: row.name,
          address: row.address || null,
          city: row.city || null,
          capacity: row.capacity != null ? Number(row.capacity) : null,
          seating_layout_description: row.seating_layout_description || null,
          seating_layout_image_url: row.seating_layout_image_url || null,
          entrance_info: row.entrance_info || null,
          transport_info: row.transport_info || null,
          rules: row.rules || null,
          map_embed_url: row.map_embed_url || null,
          faq: Array.isArray(row.faq)
            ? (row.faq as VenueFaqItem[]).filter((x) => x?.soru && x?.cevap)
            : [],
        }))
      );
    } catch (error) {
      console.error("Mekanlar yüklenemedi:", error);
    } finally {
      setLoading(false);
    }
  }

  const venuesByCity = venues.reduce<Record<string, Venue[]>>((acc, v) => {
    const city = v.city || "Diğer";
    if (!acc[city]) acc[city] = [];
    acc[city].push(v);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <Header />

      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900">Mekanlar ve Salonlar</h1>
          <p className="mt-2 text-slate-600">
            Etkinlik mekanlarımız, oturma düzenleri, ulaşım ve giriş bilgileri.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
          </div>
        ) : venues.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
            <MapPin className="mx-auto h-16 w-16 text-slate-300" />
            <p className="mt-4 text-lg font-medium">Henüz mekan eklenmemiş</p>
          </div>
        ) : (
          <div className="space-y-10">
            {Object.entries(venuesByCity).map(([city, cityVenues]) => (
              <section key={city}>
                <h2 className="mb-4 text-xl font-semibold text-slate-800">{city}</h2>
                <div className="space-y-6">
                  {cityVenues.map((venue) => (
                    <div
                      key={venue.id}
                      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                    >
                      <div className="flex flex-col md:flex-row">
                        <div className="relative h-48 w-full flex-shrink-0 md:h-auto md:w-56">
                          {venue.seating_layout_image_url ? (
                            <img
                              src={venue.seating_layout_image_url}
                              alt={venue.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-slate-100">
                              <MapPin className="h-12 w-12 text-slate-400" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 p-6">
                          <h3 className="text-lg font-bold text-slate-900">{venue.name}</h3>
                          {(venue.address || venue.city) && (
                            <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                              <MapPin className="h-4 w-4 flex-shrink-0" />
                              {[venue.address, venue.city].filter(Boolean).join(", ")}
                            </p>
                          )}
                          {venue.capacity != null && (
                            <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                              <Users className="h-4 w-4 flex-shrink-0" />
                              Kapasite: {venue.capacity} kişi
                            </p>
                          )}
                          {venue.seating_layout_description && (
                            <p className="mt-3 text-sm text-slate-700">
                              {venue.seating_layout_description}
                            </p>
                          )}

                          {venue.transport_info && (
                            <div className="mt-4 flex items-start gap-2 text-sm">
                              <Car className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary-600" />
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-slate-700">Ulaşım:</span>
                                <div
                                  className="text-slate-600 prose prose-sm max-w-none [&_p]:my-1 [&_ul]:my-2"
                                  dangerouslySetInnerHTML={{ __html: venue.transport_info }}
                                />
                              </div>
                            </div>
                          )}
                          {(() => {
                            const mapUrl = extractMapEmbedUrl(venue.map_embed_url);
                            return mapUrl ? (
                              <div className="mt-4">
                                <div className="aspect-video w-full overflow-hidden rounded-lg border border-slate-200">
                                  <iframe
                                    src={mapUrl}
                                    width="100%"
                                    height="100%"
                                    style={{ border: 0 }}
                                    allowFullScreen
                                    loading="lazy"
                                    referrerPolicy="no-referrer-when-downgrade"
                                    title={`${venue.name} harita`}
                                    className="h-full w-full"
                                  />
                                </div>
                              </div>
                            ) : null;
                          })()}
                          {venue.entrance_info && (
                            <div className="mt-2 flex items-start gap-2 text-sm">
                              <DoorOpen className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary-600" />
                              <div>
                                <span className="font-medium text-slate-700">Giriş:</span>
                                <p className="text-slate-600">{venue.entrance_info}</p>
                              </div>
                            </div>
                          )}
                          {venue.rules && (
                            <p className="mt-2 text-sm text-slate-600">
                              <span className="font-medium">Kurallar:</span> {venue.rules}
                            </p>
                          )}

                          {venue.faq.length > 0 && (
                            <div className="mt-4">
                              <button
                                onClick={() =>
                                  setExpandedId((id) => (id === venue.id ? null : venue.id))
                                }
                                className="flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700"
                              >
                                <HelpCircle className="h-4 w-4" />
                                {expandedId === venue.id ? "SSS Gizle" : `${venue.faq.length} SSS`}
                                <ChevronRight
                                  className={`h-4 w-4 transition-transform ${
                                    expandedId === venue.id ? "rotate-90" : ""
                                  }`}
                                />
                              </button>
                              {expandedId === venue.id && (
                                <div className="mt-3 space-y-3 border-l-2 border-primary-200 pl-4">
                                  {venue.faq.map((item, i) => (
                                    <div key={i}>
                                      <p className="font-medium text-slate-800">{item.soru}</p>
                                      <p className="mt-1 text-sm text-slate-600">{item.cevap}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
