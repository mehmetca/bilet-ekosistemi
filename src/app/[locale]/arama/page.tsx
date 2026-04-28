import Header from "@/components/Header";
import SearchResultsClient from "./SearchResultsClient";
import { getEventsForCalendar } from "@/lib/events-server";

type PageProps = {
  searchParams?: {
    q?: string;
  };
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SearchPage({ searchParams }: PageProps) {
  const events = await getEventsForCalendar();
  const initialQuery = (searchParams?.q || "").trim();

  return (
    <>
      <Header />
      <SearchResultsClient initialQuery={initialQuery} events={events} />
    </>
  );
}

