import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendControllerGuideEmail } from "@/lib/send-controller-guide-email";
import { publicErrorMessage } from "@/lib/api-error";

async function getAuthedUser(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token) return null;
  const supabase = getSupabaseAdmin();
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  return user;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthedUser(request);
    if (!user) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("controller_requests")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      return NextResponse.json(
        { error: publicErrorMessage("Başvuru bilgisi alınamadı.", error) },
        { status: 500 }
      );
    }
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
    const fullName = (body.full_name || "").trim().slice(0, 200);
    const phone = (body.phone || "").trim().slice(0, 40);
    if (!fullName || !phone) {
      return NextResponse.json({ error: "Ad Soyad ve telefon zorunludur" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
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
    if (error) {
      return NextResponse.json(
        { error: publicErrorMessage("Başvuru kaydedilemedi.", error) },
        { status: 500 }
      );
    }

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
