import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { revalidatePublicEventCaches } from "@/lib/revalidate-public-cache";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  revalidatePublicEventCaches();
  return NextResponse.json({ ok: true });
}
