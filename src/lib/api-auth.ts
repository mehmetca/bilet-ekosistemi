import { NextRequest, NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { User } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/** Request'ten Bearer token alır. */
export function getAuthToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  return authHeader?.replace(/^Bearer\s+/i, "") ?? null;
}

/**
 * JWT ile kullanıcıyı doğrular (service role client).
 * Boş veya geçersiz token → 401.
 */
export async function authenticateWithAccessToken(
  accessToken: string | null | undefined
): Promise<{ user: User; supabase: SupabaseClient } | NextResponse> {
  const token = typeof accessToken === "string" ? accessToken.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  const supabase = getSupabaseAdmin();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  return { user, supabase };
}

/**
 * Giriş yapmış kullanıcıyı döner. Token yoksa veya geçersizse 401 response döner.
 */
export async function getAuthUser(
  request: NextRequest
): Promise<{ user: User; supabase: SupabaseClient } | NextResponse> {
  return authenticateWithAccessToken(getAuthToken(request));
}

async function requireRoleForUser(
  auth: { user: User; supabase: SupabaseClient },
  allowedRoles: string[]
): Promise<
  | { user: User; supabase: SupabaseClient; roles: string[] }
  | NextResponse
> {
  const { data: roleRows } = await auth.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", auth.user.id)
    .in("role", allowedRoles);

  const roles = [...new Set((roleRows || []).map((r) => r.role as string))];
  if (roles.length === 0) {
    return NextResponse.json(
      { error: "Bu işlem için yetkiniz yok." },
      { status: 403 }
    );
  }

  return {
    user: auth.user,
    supabase: auth.supabase,
    roles,
  };
}

/**
 * Authorization header veya düz JWT ile rol kontrolü (multipart'ta header düşebildiği için body ile yedek).
 */
export async function requireRoleWithAccessToken(
  accessToken: string | null | undefined,
  allowedRoles: string[]
): Promise<
  | { user: User; supabase: SupabaseClient; roles: string[] }
  | NextResponse
> {
  const auth = await authenticateWithAccessToken(accessToken);
  if (auth instanceof NextResponse) return auth;
  return requireRoleForUser(auth, allowedRoles);
}

/**
 * Kullanıcının belirtilen rollerden en az birine sahip olmasını zorunlu kılar.
 * Yoksa 401/403 döner. Dönen değer: { user, supabase, roles } (roles: string[]).
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: string[]
): Promise<
  | { user: User; supabase: SupabaseClient; roles: string[] }
  | NextResponse
> {
  const auth = await getAuthUser(request);
  if (auth instanceof NextResponse) return auth;
  return requireRoleForUser(auth, allowedRoles);
}

/** Sadece admin rolüne izin verir. */
export async function requireAdmin(
  request: NextRequest
): Promise<{ user: User; supabase: SupabaseClient } | NextResponse> {
  const result = await requireRole(request, ["admin"]);
  if (result instanceof NextResponse) return result;
  return { user: result.user, supabase: result.supabase };
}
