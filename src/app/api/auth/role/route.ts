import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Sunucu yapılandırma hatası" }, { status: 500 });
    }

    const supabase = createClient(url, key);
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ role: null }, { status: 200 });
    }

    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return NextResponse.json({ role: null }, { status: 200 });
    }

    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .order("role", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({ role: data?.role ?? null });
  } catch {
    return NextResponse.json({ role: null }, { status: 200 });
  }
}
