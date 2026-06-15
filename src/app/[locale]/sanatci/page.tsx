import { getArtistsForIndex } from "@/lib/artists-server";
import SanatciIndexClient from "./SanatciIndexClient";

export const revalidate = 1800;

export default async function SanatciIndexPage() {
  const artists = await getArtistsForIndex();
  return <SanatciIndexClient initialArtists={artists} />;
}
