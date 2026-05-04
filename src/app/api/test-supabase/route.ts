import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase
    .from("events")
    .select("id, slug, is_active, is_approved")
  

  return Response.json({ data, error });
}