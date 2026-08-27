import { notFound } from "next/navigation";
import { getVenueById } from "@/lib/venues-server";
import MekanDetailClient from "./MekanDetailClient";

export const revalidate = 60;

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function MekanDetailPage({ params }: PageProps) {
  const { id } = await params;
  const venue = await getVenueById(id);
  if (!venue) notFound();
  return <MekanDetailClient initialVenue={venue} venueId={id} />;
}
