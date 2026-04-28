import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendControllerGuideEmail } from "@/lib/send-controller-guide-email";

function serviceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key);
}

async function getAuthedUser(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token) return null;
  const supabase = serviceSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  return user;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthedUser(request);
    if (!user) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
    const supabase = serviceSupabase();
    const { data, error } = await supabase
      .from("controller_requests")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || null);
  } catch (err) {
    console.error("controller-request GET error:", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthedUser(request);
    if (!user) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
    const body = (await request.json()) as { full_name?: string; phone?: string };
    const fullName = (body.full_name || "").trim();
    const phone = (body.phone || "").trim();
    if (!fullName || !phone) {
      return NextResponse.json({ error: "Ad Soyad ve telefon zorunludur" }, { status: 400 });
    }

    const supabase = serviceSupabase();
    const { error } = await supabase.from("controller_requests").upsert(
      {
        user_id: user.id,
        email: user.email || "",
        full_name: fullName,
        phone,
        status: "pending",
        reviewed_at: null,
        approved_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Başvuru kaydı başarılıysa kılavuz mailini gönder (best effort)
    if (user.email) {
      const mailRes = await sendControllerGuideEmail({
        email: user.email,
        fullName: fullName,
      });
      if (!mailRes.sent) {
        console.warn("controller guide mail not sent:", mailRes.reason);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("controller-request POST error:", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

