import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/api-auth";
import { validatePagination, validateEmail } from "@/lib/validation";
import { generateStaffPassword } from "@/lib/generate-staff-password";
import {
  sendControllerApprovedEmail,
  sendControllerCredentialsEmail,
} from "@/lib/send-controller-credentials-email";

type AuthUser = { id: string; email?: string; created_at?: string };
type ControllerRequest = {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  phone: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;
  try {
    const supabase = getSupabaseAdmin();

    // Pagination parametreleri
    const { page, perPage } = validatePagination(
      request.nextUrl.searchParams.get("page") || "1",
      request.nextUrl.searchParams.get("perPage") || "50"
    );

    const [usersRes, requestsRes, controllerRequestsRes, authRes, profilesRes, eventsRes, assignmentsRes] = await Promise.all([
      supabase.from("user_roles").select("*").order("created_at", { ascending: false }),
      supabase.from("organizer_requests").select("*").eq("status", "pending").order("created_at", { ascending: false }),
      supabase.from("controller_requests").select("*").eq("status", "pending").order("created_at", { ascending: false }),
      supabase.auth.admin.listUsers({ page, perPage }),
      supabase.from("user_profiles").select("user_id, first_name, last_name, telefon, handynummer"),
      supabase.from("events").select("id, title, date, time, location").order("date", { ascending: true }),
      supabase.from("controller_event_assignments").select("controller_user_id, event_id"),
    ]);

    if (usersRes.error) {
      console.error("user_roles fetch error:", usersRes.error);
      return NextResponse.json({ error: usersRes.error.message }, { status: 500 });
    }
    if (requestsRes.error) {
      console.error("organizer_requests fetch error:", requestsRes.error);
      return NextResponse.json({ error: requestsRes.error.message }, { status: 500 });
    }
    if (controllerRequestsRes.error) {
      console.error("controller_requests fetch error:", controllerRequestsRes.error);
      return NextResponse.json({ error: controllerRequestsRes.error.message }, { status: 500 });
    }
    if (authRes.error) {
      console.error("auth listUsers error:", authRes.error);
      return NextResponse.json({ error: authRes.error.message }, { status: 500 });
    }
    const assignmentTableMissing =
      assignmentsRes.error?.code === "42P01" ||
      assignmentsRes.error?.code === "PGRST205";
    if (profilesRes.error || eventsRes.error || (assignmentsRes.error && !assignmentTableMissing)) {
      const error = profilesRes.error || eventsRes.error || assignmentsRes.error;
      console.error("controller management data error:", error);
      return NextResponse.json({ error: "Kontrolör yönetim bilgileri yüklenemedi." }, { status: 500 });
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
    const profileMap = new Map((profilesRes.data || []).map((profile) => [profile.user_id, profile]));
    const allUsers = authUsers
      .map((u) => {
        const profile = profileMap.get(u.id);
        const metadata = (u as AuthUser & { user_metadata?: Record<string, unknown> }).user_metadata || {};
        const firstName = profile?.first_name || String(metadata.first_name || "");
        const lastName = profile?.last_name || String(metadata.last_name || "");
        return {
          user_id: u.id,
          email: u.email || null,
          created_at: u.created_at,
          roles: roleMap.get(u.id) || [],
          full_name: [firstName, lastName].filter(Boolean).join(" ") || String(metadata.full_name || ""),
          phone: profile?.telefon || profile?.handynummer || String(metadata.phone || ""),
        };
      })
      .sort((a, b) => {
        const aT = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bT = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bT - aT;
      });

    return NextResponse.json({
      users: allUsers,
      userRoles,
      organizerRequests: requestsRes.data || [],
      controllerRequests: (controllerRequestsRes.data || []) as ControllerRequest[],
      events: eventsRes.data || [],
      controllerAssignments: assignmentsRes.data || [],
      controllerAssignmentTableReady: !assignmentsRes.error,
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

    if (action === "createController") {
      const {
        email,
        password,
        firstName,
        lastName,
        phone,
        eventIds: rawEventIds,
      } = body as {
        email?: string;
        password?: string;
        firstName?: string;
        lastName?: string;
        phone?: string;
        eventIds?: unknown;
      };
      const cleanEmail = String(email || "").trim().toLowerCase();
      const cleanFirstName = String(firstName || "").trim().slice(0, 100);
      const cleanLastName = String(lastName || "").trim().slice(0, 100);
      const cleanPhone = String(phone || "").trim().slice(0, 40);
      /** Şifre boş bırakılırsa sistem üretir ve yalnızca mail ile gönderilir. */
      const suppliedPassword = String(password || "");
      const generatedPassword = !suppliedPassword;
      const cleanPassword = generatedPassword ? generateStaffPassword() : suppliedPassword;
      const eventIds = Array.isArray(rawEventIds)
        ? [...new Set(rawEventIds.filter((id): id is string => typeof id === "string" && id.length > 0))]
        : [];

      if (!validateEmail(cleanEmail) || !cleanFirstName || !cleanLastName || !cleanPhone) {
        return NextResponse.json({ error: "Ad, soyad, telefon ve geçerli e-posta zorunludur." }, { status: 400 });
      }
      if (!generatedPassword && (cleanPassword.length < 8 || cleanPassword.length > 72)) {
        return NextResponse.json({ error: "Şifre 8-72 karakter arasında olmalıdır." }, { status: 400 });
      }
      if (cleanPhone.replace(/\D/g, "").length < 7) {
        return NextResponse.json({ error: "Geçerli bir telefon numarası giriniz." }, { status: 400 });
      }

      if (eventIds.length > 0) {
        const { data: matchedEvents, error: eventError } = await supabase
          .from("events")
          .select("id")
          .in("id", eventIds);
        if (eventError || matchedEvents?.length !== eventIds.length) {
          return NextResponse.json({ error: "Seçilen etkinliklerden biri bulunamadı." }, { status: 400 });
        }
      }

      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email: cleanEmail,
        password: cleanPassword,
        email_confirm: true,
        user_metadata: {
          role: "controller",
          created_by: "admin",
          first_name: cleanFirstName,
          last_name: cleanLastName,
          full_name: `${cleanFirstName} ${cleanLastName}`,
          phone: cleanPhone,
        },
      });
      if (createError || !created.user?.id) {
        const alreadyExists = /already|registered|exists/i.test(createError?.message || "");
        return NextResponse.json(
          { error: alreadyExists ? "Bu e-posta adresi zaten kayıtlı." : createError?.message || "Kontrolör oluşturulamadı." },
          { status: alreadyExists ? 409 : 500 }
        );
      }

      const userId = created.user.id;
      const rollbackUser = async (message: string) => {
        await supabase.auth.admin.deleteUser(userId);
        return NextResponse.json({ error: message }, { status: 500 });
      };

      const { error: roleError } = await supabase.from("user_roles").upsert(
        { user_id: userId, role: "controller" },
        { onConflict: "user_id,role" }
      );
      if (roleError) return rollbackUser(`Kontrolör rolü atanamadı: ${roleError.message}`);

      const { error: profileError } = await supabase.from("user_profiles").upsert(
        {
          user_id: userId,
          first_name: cleanFirstName,
          last_name: cleanLastName,
          email: cleanEmail,
          telefon: cleanPhone,
          handynummer: cleanPhone,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      if (profileError) return rollbackUser(`Kontrolör profili kaydedilemedi: ${profileError.message}`);

      if (eventIds.length > 0) {
        const { error: assignmentError } = await supabase
          .from("controller_event_assignments")
          .insert(eventIds.map((eventId) => ({ controller_user_id: userId, event_id: eventId })));
        if (assignmentError) return rollbackUser(`Etkinlik atamaları kaydedilemedi: ${assignmentError.message}`);
      }

      const mail = await sendControllerCredentialsEmail({
        email: cleanEmail,
        fullName: `${cleanFirstName} ${cleanLastName}`,
        password: cleanPassword,
      });

      // Üretilen şifre yalnız bu mailde: gitmezse hesap kimsenin bilmediği bir şifreyle açık kalır.
      if (!mail.sent && generatedPassword) {
        return rollbackUser(
          `Kontrolör hesabı oluşturuldu fakat giriş maili gönderilemedi (${mail.reason || "bilinmeyen neden"}); hesap geri alındı. Lütfen tekrar deneyin.`
        );
      }

      return NextResponse.json({
        success: true,
        userId,
        passwordGenerated: generatedPassword,
        mailSent: mail.sent,
        mailReason: mail.reason,
      });
    }

    if (action === "assignControllerEvents") {
      const { userId, eventIds: rawEventIds } = body as { userId?: string; eventIds?: unknown };
      if (!userId || !Array.isArray(rawEventIds)) {
        return NextResponse.json({ error: "Kontrolör ve etkinlik listesi zorunludur." }, { status: 400 });
      }
      const eventIds = [...new Set(rawEventIds.filter((id): id is string => typeof id === "string" && id.length > 0))];
      const { data: controllerRole, error: roleLookupError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("user_id", userId)
        .eq("role", "controller")
        .maybeSingle();
      if (roleLookupError || !controllerRole) {
        return NextResponse.json({ error: "Kontrolör hesabı bulunamadı." }, { status: 404 });
      }

      if (eventIds.length > 0) {
        const { data: matchedEvents, error: eventError } = await supabase
          .from("events")
          .select("id")
          .in("id", eventIds);
        if (eventError || matchedEvents?.length !== eventIds.length) {
          return NextResponse.json({ error: "Seçilen etkinliklerden biri bulunamadı." }, { status: 400 });
        }
      }

      const { data: existing, error: existingError } = await supabase
        .from("controller_event_assignments")
        .select("event_id")
        .eq("controller_user_id", userId);
      if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

      const existingIds = new Set((existing || []).map((row) => row.event_id as string));
      const desiredIds = new Set(eventIds);
      const additions = eventIds.filter((eventId) => !existingIds.has(eventId));
      if (additions.length > 0) {
        const { error: addError } = await supabase.from("controller_event_assignments").insert(
          additions.map((eventId) => ({ controller_user_id: userId, event_id: eventId }))
        );
        if (addError) return NextResponse.json({ error: addError.message }, { status: 500 });
      }

      const removals = [...existingIds].filter((eventId) => !desiredIds.has(eventId));
      if (removals.length > 0) {
        const { error: removeError } = await supabase
          .from("controller_event_assignments")
          .delete()
          .eq("controller_user_id", userId)
          .in("event_id", removals);
        if (removeError) return NextResponse.json({ error: removeError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (action === "add") {
      const { email, role } = body as { email?: string; role?: string };
      if (!email || !role) {
        return NextResponse.json({ error: "email ve role gerekli" }, { status: 400 });
      }
      if (role !== "admin") {
        return NextResponse.json(
          { error: "Kontrolörler ad, telefon, şifre ve etkinlik atamasıyla oluşturulmalıdır." },
          { status: 400 }
        );
      }
      if (!validateEmail(email)) {
        return NextResponse.json({ error: "Geçersiz e-posta formatı" }, { status: 400 });
      }
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const userExists = existingUsers?.users?.some((u: { email?: string }) => u.email === email);
      if (userExists) {
        return NextResponse.json({ error: "Bu e-posta zaten kayıtlı" }, { status: 409 });
      }
      const { data: createData, error: createError } = await supabase.auth.admin.createUser({
        email,
        // Rastgele güçlü şifre: gösterilmez de gönderilmez de. Yönetici hesabı açmak için;
        // gerçek erişim için Supabase "şifre sıfırlama" maili gerekir.
        password: generateStaffPassword(20),
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

    if (action === "approveController") {
      const { requestId } = body as { requestId?: string };
      if (!requestId) return NextResponse.json({ error: "requestId gerekli" }, { status: 400 });

      const { data: req } = await supabase
        .from("controller_requests")
        .select("id,user_id,email,full_name,phone")
        .eq("id", requestId)
        .single();
      if (!req) return NextResponse.json({ error: "Başvuru bulunamadı" }, { status: 404 });

      const { error: roleErr } = await supabase
        .from("user_roles")
        .upsert({ user_id: req.user_id, role: "controller" }, { onConflict: "user_id,role" });
      if (roleErr) return NextResponse.json({ error: roleErr.message }, { status: 500 });

      const [firstName, ...lastNameParts] = String(req.full_name || "").trim().split(/\s+/);
      const { error: profileError } = await supabase.from("user_profiles").upsert(
        {
          user_id: req.user_id,
          first_name: firstName || null,
          last_name: lastNameParts.join(" ") || null,
          email: req.email,
          telefon: req.phone,
          handynummer: req.phone,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

      const { error: updErr } = await supabase
        .from("controller_requests")
        .update({ status: "approved", reviewed_at: new Date().toISOString(), approved_at: new Date().toISOString() })
        .eq("id", requestId);
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

      const mail = await sendControllerApprovedEmail({ email: req.email, fullName: req.full_name });

      return NextResponse.json({ success: true, mailSent: mail.sent, mailReason: mail.reason });
    }

    if (action === "rejectController") {
      const { requestId } = body as { requestId?: string };
      if (!requestId) return NextResponse.json({ error: "requestId gerekli" }, { status: 400 });
      const { error: updErr } = await supabase
        .from("controller_requests")
        .update({ status: "rejected", reviewed_at: new Date().toISOString() })
        .eq("id", requestId);
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === "removeRole") {
      const { userId, role } = body as { userId?: string; role?: string };
      if (!userId || !role) {
        return NextResponse.json({ error: "userId ve role gerekli" }, { status: 400 });
      }
      if (role === "controller") {
        const { error: assignmentError } = await supabase
          .from("controller_event_assignments")
          .delete()
          .eq("controller_user_id", userId);
        if (assignmentError) return NextResponse.json({ error: assignmentError.message }, { status: 500 });
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
