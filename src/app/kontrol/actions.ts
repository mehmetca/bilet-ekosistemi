"use server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { extractTicketCode } from "@/lib/ticket-code";
import { assertStaffFromCookies } from "@/lib/server-staff-auth";
import { buildStaffAllowedEventIds } from "@/lib/staff-event-scope";

export type DoorPrevious = {
  at?: string | null;
  actor?: string | null;
  actorName?: string | null;
  gate?: string | null;
  logId?: string | null;
};

/**
 * Düz tip: proje `strict:false` (strictNullChecks kapalı) derleniyor, bu yüzden
 * `valid` üzerinden birleşim daraltması çalışmıyor — alanlar opsiyonel okunur.
 */
export type CheckResult = {
  valid: boolean;
  reason?: "not_found" | "used" | "invalid" | "error";
  message?: string;
  /** Bilet bu çağrıda giriş işaretlendi mi. */
  marked?: boolean;
  /** Etkinlik yetkisi yoksa bilet geçerlidir ama işaretlenmemiştir. */
  scopeDenied?: boolean;
  /** Daha önce okutulmuşsa ilk giriş kaydı (zaman/görevli/kapı). */
  previous?: DoorPrevious;
  eventId?: string;
  eventTitle?: string;
  eventDate?: string;
  eventTime?: string;
  venue?: string;
  buyerName?: string;
  buyerEmail?: string;
  quantity?: number;
  /** Sunucunun eşleştirdiği bilet satırı (mutabakat raporunda cihaz kaydıyla karşılaştırılır). */
  refKind?: "unit" | "seat" | "order";
  refId?: string;
  codeKey?: string;
  logId?: string;
  source?: "online" | "offline";
  /** Çevrimdışı kararda: cihaz listesinden geldi, sunucuya yazılmayı bekliyor. */
  offline?: boolean;
  offlineMarked?: boolean;
  seatSection?: string | null;
  seatRow?: string | null;
  seatLabel?: string | null;
};

export type CheckTicketOptions = {
  /** true → okunan bilet giriş olarak işaretlenir (kapı akışı). */
  mark?: boolean;
  actorUserId?: string;
  /** Personelin işaretleyebileceği etkinlikler; null/undefined = sınırsız (admin). */
  allowedEventIds?: string[] | null;
  /** Çevrimdışı kuyruk: tekrar gönderimde tek log satırı üreten anahtar. */
  clientEventId?: string;
  /** Cihazın okuma anı + kaynak etiketi, log yazıldıktan sonra işlenir (150). */
  offline?: { scannedAt: string; deviceId?: string | null };
};

/** API route ve server action tarafından ortak çağrılan tek turda kapı kontrolü. */
export async function checkTicketCore(
  input: string | FormData,
  options: CheckTicketOptions = {}
): Promise<CheckResult> {
  const rawCode =
    typeof input === "string" ? input : String(input.get("ticket_code") || "");
  const ticketCode = extractTicketCode(rawCode);

  if (!ticketCode) {
    return { valid: false, reason: "invalid", message: "Bilet kodu zorunludur." };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("check_ticket_door", {
      p_code: ticketCode,
      p_actor: options.actorUserId ?? null,
      p_mark: options.mark === true,
      p_allowed_event_ids: options.allowedEventIds ?? null,
      p_client_event_id: options.clientEventId ?? null,
    });

    if (error) {
      console.error("check_ticket_door rpc error:", error);
      // Yalnızca personel ekranı: altta yatan hatayı göstermeden kapıda teşhis imkânsız.
      const code = (error as { code?: string }).code;
      const detail = (error as { message?: string }).message;
      const suffix = [code, detail].filter(Boolean).join(" ");
      return {
        valid: false,
        reason: "error",
        message:
          "Kapı kontrol fonksiyonu çalıştırılamadı." +
          (suffix ? ` ${suffix}` : "") +
          " 121/122 migration'larının bu projede uygulandığını ve PostgREST şemasının tazeliğini doğrulayın.",
      };
    }

    const row = data as CheckResult | null;
    if (!row) {
      return { valid: false, reason: "not_found" };
    }

    // Çevrimdışı kuyruk okuması: sunucu 'online' yazdı, cihaz saatına çevrilir.
    if (options.offline && row.logId) {
      await supabase.rpc("mark_scan_offline", {
        p_log_id: row.logId,
        p_scanned_at: options.offline.scannedAt,
        p_device_id: options.offline.deviceId ?? null,
      });
    }
    const offlinePatch = options.offline
      ? { source: "offline" as const, offline: true }
      : {};

    // Eski check_ticket_door sürümünde ad boş kalır; tek kolonluk rpc ile doldurulur.
    if (row.previous && !row.previous.actorName && row.previous.actor) {
      const { data: name } = await supabase.rpc("staff_display_name", {
        p_user_id: row.previous.actor,
      });
      if (typeof name === "string" && name) {
        row.previous = { ...row.previous, actorName: name };
      }
    }

    if (row.valid) {
      return { ...row, valid: true, marked: row.marked === true, scopeDenied: row.scopeDenied === true, ...offlinePatch };
    }

    return { ...row, valid: false, reason: row.reason ?? "invalid", ...offlinePatch };
  } catch (error) {
    console.error("Ticket check server error:", error);
    return { valid: false, reason: "error", message: "Sunucu hatası" };
  }
}

/**
 * Yalnızca admin/controller/organizer — çerez oturumu gerekir.
 * Ortak gövde: `mark` false → salt doğrulama, true → girişi işaretle.
 */
async function runDoorCheck(input: string | FormData, mark: boolean): Promise<CheckResult> {
  const auth = await assertStaffFromCookies();
  if (auth.ok === false) {
    return {
      valid: false,
      reason: "error",
      message:
        auth.reason === "unauthenticated"
          ? "Bilet kontrolü için giriş yapmanız gerekiyor."
          : "Bu işlem için yetkiniz yok.",
    };
  }

  const allowedEventIds = await buildStaffAllowedEventIds(
    getSupabaseAdmin(),
    auth.roles,
    auth.user.id
  );

  const result = await checkTicketCore(input, {
    mark,
    actorUserId: auth.user.id,
    allowedEventIds,
  });

  if (result.valid && result.scopeDenied) {
    return {
      valid: false,
      reason: "error",
      eventId: result.eventId,
      message: "Bu etkinliğe check-in yetkiniz yok.",
    };
  }

  return result;
}

/**
 * Kapıda doğrulama adımı: bilet geçerli mi — İŞARETLEMEZ.
 * Personel kendi/deneme biletlerini okutabildiği için otomatik işaretleme
 * gerçek bilet sahibini kapıda düşürür; giriş onayı ayrı insan hamlesidir.
 */
export async function verifyTicketAtDoor(input: string | FormData): Promise<CheckResult> {
  return runDoorCheck(input, false);
}

/** Görevlinin "Giriş işaretle" hamlesi: bilet ancak burada kullanıma kapanır. */
export async function markTicketEntry(input: string | FormData): Promise<CheckResult> {
  return runDoorCheck(input, true);
}
