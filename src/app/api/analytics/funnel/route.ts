import { createServerSupabase } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, event_id, ticket_id, session_id, hero_variant } = body;

    if (!type || !event_id) {
      return NextResponse.json(
        { error: "type ve event_id gerekli" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    if (type === "view") {
      const { error } = await supabase.from("event_views").insert({
        event_id,
        session_id: session_id || null,
        hero_variant: hero_variant || null,
      });
      if (error) {
        console.error("event_views insert error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    if (type === "purchase_intent") {
      const { error } = await supabase.from("purchase_intents").insert({
        event_id,
        ticket_id: ticket_id || null,
        session_id: session_id || null,
        hero_variant: hero_variant || null,
        success: false, // API yanıtından sonra güncellenebilir
      });
      if (error) {
        console.error("purchase_intents insert error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Geçersiz type" }, { status: 400 });
  } catch (e) {
    console.error("Funnel analytics error:", e);
    return NextResponse.json(
      { error: "Analitik kaydı alınamadı" },
      { status: 500 }
    );
  }
}
