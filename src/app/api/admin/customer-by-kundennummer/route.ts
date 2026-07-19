import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_FRAGMENT_RE = /^[0-9a-f]{4,32}$/i;

type ProfileRow = Record<string, unknown> & { user_id: string; email?: string | null };

type OrderRow = {
  id: string;
  event_id: string;
  ticket_id: string | null;
  quantity: number;
  total_price: number;
  ticket_code?: string;
  status: string;
  buyer_name?: string;
  buyer_email?: string;
  created_at: string;
  events?: { title?: string; date?: string; time?: string; venue?: string } | null;
  tickets?: { name?: string; type?: string; price?: number } | null;
};

/** tickets gömüsü FK yoksa tüm sorguyu düşürür — event gömülü, ticket ayrı. */
const SELECT_FIELDS = `
  id,
  event_id,
  ticket_id,
  quantity,
  total_price,
  ticket_code,
  status,
  buyer_name,
  buyer_email,
  created_at,
  events (
    title,
    date,
    time,
    venue
  )
`;

async function loadOrdersForUser(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  email: string | null | undefined
): Promise<OrderRow[]> {
  const emailTrim = (email || "").trim();

  const queryPromises = [
    supabase
      .from("orders")
      .select(SELECT_FIELDS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    ...(emailTrim
      ? [
          // user_id bağlı olsun olmasın e-posta ile de bul (misafir / farklı hesap)
          supabase
            .from("orders")
            .select(SELECT_FIELDS)
            .ilike("buyer_email", emailTrim)
            .order("created_at", { ascending: false }),
        ]
      : []),
  ];

  const results = await Promise.all(queryPromises);
  const seen = new Set<string>();
  const merged: OrderRow[] = [];

  for (const r of results) {
    if (r.error) {
      console.error("customer orders query skipped:", r.error.message);
      continue;
    }
    for (const row of r.data || []) {
      const o = row as OrderRow;
      if (o.id && !seen.has(o.id)) {
        seen.add(o.id);
        merged.push(o);
      }
    }
  }

  // Gömülü events de düşerse düz sorguya düş
  if (merged.length === 0) {
    const fallbackQueries = [
      supabase
        .from("orders")
        .select(
          "id, event_id, ticket_id, quantity, total_price, ticket_code, status, buyer_name, buyer_email, created_at"
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      ...(emailTrim
        ? [
            supabase
              .from("orders")
              .select(
                "id, event_id, ticket_id, quantity, total_price, ticket_code, status, buyer_name, buyer_email, created_at"
              )
              .ilike("buyer_email", emailTrim)
              .order("created_at", { ascending: false }),
          ]
        : []),
    ];
    const fallbackResults = await Promise.all(fallbackQueries);
    for (const r of fallbackResults) {
      if (r.error) {
        console.error("customer orders fallback skipped:", r.error.message);
        continue;
      }
      for (const row of r.data || []) {
        const o = row as OrderRow;
        if (o.id && !seen.has(o.id)) {
          seen.add(o.id);
          merged.push(o);
        }
      }
    }

    // Event başlıklarını ayrı çek
    const eventIds = Array.from(new Set(merged.map((o) => o.event_id).filter(Boolean)));
    if (eventIds.length > 0) {
      const { data: eventRows } = await supabase
        .from("events")
        .select("id, title, date, time, venue")
        .in("id", eventIds);
      const eventMap = new Map(
        (eventRows || []).map((e) => [
          e.id as string,
          {
            title: e.title as string | undefined,
            date: e.date as string | undefined,
            time: e.time as string | undefined,
            venue: e.venue as string | undefined,
          },
        ])
      );
      for (const o of merged) {
        o.events = eventMap.get(o.event_id) || null;
      }
    }
  }

  merged.sort((a, b) => {
    const aT = new Date(a.created_at || 0).getTime();
    const bT = new Date(b.created_at || 0).getTime();
    return bT - aT;
  });

  const ticketIds = Array.from(
    new Set(merged.map((o) => o.ticket_id).filter((id): id is string => !!id))
  );
  if (ticketIds.length > 0) {
    const { data: ticketRows, error: ticketErr } = await supabase
      .from("tickets")
      .select("id, name, type, price")
      .in("id", ticketIds);
    if (ticketErr) {
      console.error("customer orders tickets lookup:", ticketErr.message);
    } else if (ticketRows) {
      const ticketMap = new Map(
        ticketRows.map((row) => [
          row.id as string,
          {
            name: row.name as string | undefined,
            type: row.type as string | undefined,
            price: row.price as number | undefined,
          },
        ])
      );
      for (const o of merged) {
        if (o.ticket_id) o.tickets = ticketMap.get(o.ticket_id) || null;
      }
    }
  }

  return merged;
}

async function findProfileByQuery(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  q: string
): Promise<ProfileRow | null> {
  const normalized = q.trim();
  if (!normalized) return null;

  // 1) Tam / kısmi Kundennummer
  {
    const { data } = await supabase
      .from("user_profiles")
      .select("*")
      .ilike("kundennummer", `%${normalized}%`)
      .limit(5);
    if (data && data.length === 1) return data[0] as ProfileRow;
    if (data && data.length > 1) {
      const exact = data.find(
        (p) => String((p as ProfileRow).kundennummer || "").toLowerCase() === normalized.toLowerCase()
      );
      if (exact) return exact as ProfileRow;
      return data[0] as ProfileRow;
    }
  }

  // 2) E-posta
  if (normalized.includes("@")) {
    const { data } = await supabase
      .from("user_profiles")
      .select("*")
      .ilike("email", normalized)
      .limit(1)
      .maybeSingle();
    if (data) return data as ProfileRow;

    const { data: authList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const authUser = (authList?.users || []).find(
      (u) => (u.email || "").toLowerCase() === normalized.toLowerCase()
    );
    if (authUser?.id) {
      const { data: byUserId } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", authUser.id)
        .maybeSingle();
      if (byUserId) return byUserId as ProfileRow;
      return {
        user_id: authUser.id,
        email: authUser.email || null,
        kundennummer: null,
        first_name: null,
        last_name: null,
      } as ProfileRow;
    }
  }

  // 3) Tam UUID
  if (UUID_RE.test(normalized)) {
    const { data } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", normalized)
      .maybeSingle();
    if (data) return data as ProfileRow;

    const { data: authUser } = await supabase.auth.admin.getUserById(normalized);
    if (authUser?.user) {
      return {
        user_id: authUser.user.id,
        email: authUser.user.email || null,
        kundennummer: null,
      } as ProfileRow;
    }
  }

  // 4) UUID / hex parçası (örn. cdaf5204)
  if (HEX_FRAGMENT_RE.test(normalized) && !normalized.includes("@")) {
    const frag = normalized.toLowerCase().replace(/-/g, "");
    const { data: profiles } = await supabase.from("user_profiles").select("*").limit(500);
    const hit = (profiles || []).find((p) =>
      String((p as ProfileRow).user_id || "")
        .replace(/-/g, "")
        .toLowerCase()
        .includes(frag)
    );
    if (hit) return hit as ProfileRow;

    const { data: authList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const authHit = (authList?.users || []).find((u) =>
      u.id.replace(/-/g, "").toLowerCase().includes(frag)
    );
    if (authHit) {
      const { data: byUserId } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", authHit.id)
        .maybeSingle();
      if (byUserId) return byUserId as ProfileRow;
      return {
        user_id: authHit.id,
        email: authHit.email || null,
        kundennummer: null,
      } as ProfileRow;
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const q =
      searchParams.get("q")?.trim() ||
      searchParams.get("kundennummer")?.trim() ||
      "";
    if (!q) {
      return NextResponse.json(
        { error: "Arama terimi gerekli (Kundennummer, e-posta veya müşteri ID)" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const profile = await findProfileByQuery(supabase, q);

    if (!profile) {
      return NextResponse.json({ error: "Müşteri bulunamadı", found: false }, { status: 404 });
    }

    const userId = profile.user_id as string;

    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    const authInfo = authUser?.user
      ? {
          email: authUser.user.email,
          created_at: authUser.user.created_at,
          last_sign_in_at: authUser.user.last_sign_in_at,
          user_id: authUser.user.id,
        }
      : { user_id: userId };

    const email = authInfo?.email || (profile.email as string | null | undefined);
    const orders = await loadOrdersForUser(supabase, userId, email);

    return NextResponse.json({
      profile,
      authInfo,
      orders,
      matchedBy: q,
    });
  } catch (err) {
    console.error("customer-by-kundennummer error:", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
