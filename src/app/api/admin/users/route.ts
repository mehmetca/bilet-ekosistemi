import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/api-auth";

type AuthUser = { id: string; email?: string; created_at?: string };

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;
  try {
    const supabase = getSupabaseAdmin();

    const [usersRes, requestsRes, authRes] = await Promise.all([
      supabase.from("user_roles").select("*").order("created_at", { ascending: false }),
      supabase.from("organizer_requests").select("*").eq("status", "pending").order("created_at", { ascending: false }),
      supabase.auth.admin.listUsers({ perPage: 1000 }),
    ]);

    if (usersRes.error) {
      console.error("user_roles fetch error:", usersRes.error);
      return NextResponse.json({ error: usersRes.error.message }, { status: 500 });
    }
    if (requestsRes.error) {
      console.error("organizer_requests fetch error:", requestsRes.error);
      return NextResponse.json({ error: requestsRes.error.message }, { status: 500 });
    }
    if (authRes.error) {
      console.error("auth listUsers error:", authRes.error);
      return NextResponse.json({ error: authRes.error.message }, { status: 500 });
    }

    const userRoles = usersRes.data || [];
    const roleMap = new Map<string, string[]>();
    for (const ur of userRoles) {
      if (ur.user_id) {
        const roles = roleMap.get(ur.user_id) || [];
        if (ur.role && !roles.includes(ur.role)) roles.push(ur.role);
        roleMap.set(ur.user_id, roles);
      }
    }

    const authUsers = (authRes.data?.users || []) as AuthUser[];
    const allUsers = authUsers
      .map((u) => ({
        user_id: u.id,
        email: u.email || null,
        created_at: u.created_at,
        roles: roleMap.get(u.id) || [],
      }))
      .sort((a, b) => {
        const aT = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bT = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bT - aT;
      });

    return NextResponse.json({
      users: allUsers,
      userRoles,
      organizerRequests: requestsRes.data || [],
    });
  } catch (err) {
    console.error("admin users API error:", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;
  try {
    const body = await request.json();
    const { action } = body as { action?: string };
    const supabase = getSupabaseAdmin();

    if (action === "add") {
      const { email, role } = body as { email?: string; role?: string };
      if (!email || !role) {
        return NextResponse.json({ error: "email ve role gerekli" }, { status: 400 });
      }
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const userExists = existingUsers?.users?.some((u: { email?: string }) => u.email === email);
      if (userExists) {
        return NextResponse.json({ error: "Bu e-posta zaten kayıtlı" }, { status: 409 });
      }
      const { data: createData, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: Math.random().toString(36).substring(2, 15),
        email_confirm: true,
        user_metadata: { role, created_by: "admin" },
      });
      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 });
      }
      if (!createData.user?.id) {
        return NextResponse.json({ error: "Kullanıcı oluşturulamadı" }, { status: 500 });
      }
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: createData.user.id,
        role: role as string,
      });
      if (roleError) {
        return NextResponse.json({ error: "Rol atanamadı: " + roleError.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === "approve") {
      const { requestId } = body as { requestId?: string };
      if (!requestId) {
        return NextResponse.json({ error: "requestId gerekli" }, { status: 400 });
      }
      const { data: req } = await supabase
        .from("organizer_requests")
        .select("user_id, email, organization_display_name, company_name, representative_name")
        .eq("id", requestId)
        .single();
      if (!req) {
        return NextResponse.json({ error: "Başvuru bulunamadı" }, { status: 404 });
      }
      const { error: roleErr } = await supabase.from("user_roles").insert({ user_id: req.user_id, role: "organizer" });
      if (roleErr) {
        return NextResponse.json({ error: "Rol eklenemedi: " + roleErr.message }, { status: 500 });
      }
      const displayName =
        (req as { organization_display_name?: string }).organization_display_name?.trim() ||
        (req as { company_name?: string }).company_name?.trim() ||
        (req as { representative_name?: string }).representative_name?.trim() ||
        "Organizatör";
      await supabase.from("organizer_profiles").upsert(
        {
          user_id: req.user_id,
          organization_display_name: displayName,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      await supabase
        .from("organizer_requests")
        .update({ status: "approved", approved_at: new Date().toISOString(), reviewed_at: new Date().toISOString() })
        .eq("id", requestId);
      return NextResponse.json({ success: true });
    }

    if (action === "reject") {
      const { requestId } = body as { requestId?: string };
      if (!requestId) {
        return NextResponse.json({ error: "requestId gerekli" }, { status: 400 });
      }
      await supabase
        .from("organizer_requests")
        .update({ status: "rejected", reviewed_at: new Date().toISOString() })
        .eq("id", requestId);
      return NextResponse.json({ success: true });
    }

    if (action === "removeRole") {
      const { userId, role } = body as { userId?: string; role?: string };
      if (!userId || !role) {
        return NextResponse.json({ error: "userId ve role gerekli" }, { status: 400 });
      }
      const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === "delete") {
      const { userId } = body as { userId?: string };
      if (!userId) {
        return NextResponse.json({ error: "userId gerekli" }, { status: 400 });
      }
      // orders.user_id FK engelleyebilir; önce null yap
      await supabase.from("orders").update({ user_id: null }).eq("user_id", userId);
      const { error: delErr } = await supabase.auth.admin.deleteUser(userId);
      if (delErr) {
        console.error("deleteUser error:", delErr);
        return NextResponse.json({ error: delErr.message || "Kullanıcı silinemedi" }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Geçersiz action" }, { status: 400 });
  } catch (err) {
    console.error("admin users POST error:", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
