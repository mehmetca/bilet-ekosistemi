import Header from "@/components/Header";
import SearchResultsClient from "./SearchResultsClient";
import { getEventsForCalendar } from "@/lib/events-server";

type PageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

export const revalidate = 1800;

export default async function SearchPage({ searchParams }: PageProps) {
  const events = await getEventsForCalendar();
  const resolvedSearchParams = await searchParams;
  const initialQuery = (resolvedSearchParams?.q || "").trim();

  return (
    <>
      <Header />
      <SearchResultsClient initialQuery={initialQuery} events={events} />
    </>
  );
}

