import { NextRequest, NextResponse } from "next/server";
import { getAuthUserWithSession } from "@/lib/api-auth";
import { buildStaffAllowedEventIds } from "@/lib/staff-event-scope";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { issueInvoiceForOrder } from "@/lib/invoice";
import type { StaffRole } from "@/lib/server-staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STAFF_ROLES: StaffRole[] = ["admin", "organizer", "controller", "gate_sales"];

/**
 * Fatura kesme: siparişin organizatör satıcılı Alman Rechnung'u.
 * Idempotent — aynı sipariş ikinci kez kesilirse mevcut fatura döner.
 *
 * Yetki: müşteri yalnız kendi siparişi; personel yalnız görev kapsamındaki
 * etkinlikler (buildStaffAllowedEventIds → admin = sınırsız).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUserWithSession(request);
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    const ip = getClientIp(request);
    if (!checkRateLimit(ip, { name: "invoice-issue", windowMs: 60_000, max: 30 })) {
      return NextResponse.json(
        { success: false, message: "Çok fazla fatura isteği. Lütfen biraz bekleyin." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const orderId = String(body.order_id ?? "").trim();
    if (!orderId) {
      return NextResponse.json(
        { success: false, message: "Sipariş gerekli." },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id, user_id, buyer_email, event_id, status")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, message: "Sipariş bulunamadı." },
        { status: 404 }
      );
    }

    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .limit(100);
    const roles = [...new Set((roleRows || []).map((r) => r.role as string))];
    const isStaff = STAFF_ROLES.some((role) => roles.includes(role));
    const isBuyer =
      order.user_id === user.id ||
      (!order.user_id &&
        Boolean(order.buyer_email) &&
        String(order.buyer_email).toLowerCase() === String(user.email || "").toLowerCase());

    if (!isStaff && !isBuyer) {
      return NextResponse.json(
        { success: false, message: "Bu sipariş için fatura kesme yetkin yok." },
        { status: 403 }
      );
    }

    // Müşteri kendi siparişinde kapsam denetlemesine takılmaz; RPC zaten sipariş
    // üzerinden işliyor ve alıcı sırrı yalnızca kendi belgesini görür.
    const scope = isStaff ? await buildStaffAllowedEventIds(admin, roles as StaffRole[], user.id) : null;

    const result = await issueInvoiceForOrder(orderId, {
      actorUserId: user.id,
      allowedEventIds: scope,
    });

    if (!result.ok || !result.row) {
      const status =
        result.code === "forbidden" ? 403 : result.code === "not_found" ? 404 : 400;
      return NextResponse.json(
        {
          success: false,
          code: result.code ?? "error",
          message: result.message ?? "Fatura üretilemedi.",
        },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      created: result.created === true,
      invoice: result.row,
    });
  } catch (error) {
    console.error("invoice issue error:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          "Fatura üretilemedi. 151 migration'ının uygulandığını ve PostgREST şemasının tazeliğini doğrulayın.",
      },
      { status: 500 }
    );
  }
}
