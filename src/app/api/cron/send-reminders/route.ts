import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendReminderEmail } from "@/lib/send-reminder-email";

function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/**
 * Vercel Cron ile çağrılır. Etkinlikten 24 saat önce hatırlatma maili gönderir.
 * CRON_SECRET ile korunur.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Supabase config missing" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // 24 saat sonra başlayacak etkinlikler (20–28 saat aralığında)
  const now = new Date();
  const windowStart = new Date(now.getTime() + 20 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 28 * 60 * 60 * 1000);
  const dateStart = windowStart.toISOString().slice(0, 10);
  const dateEnd = windowEnd.toISOString().slice(0, 10);

  const { data: rawEvents, error: eventsError } = await supabase
    .from("events")
    .select("id, slug, title, date, time, venue")
    .gte("date", dateStart)
    .lte("date", dateEnd)
    .eq("is_active", true);

  const events = (rawEvents || []).filter((e) => {
    const eventDt = new Date(`${e.date}T${e.time || "12:00"}`);
    return eventDt >= windowStart && eventDt <= windowEnd;
  });

  if (eventsError) {
    return NextResponse.json({ error: "Events fetch failed" }, { status: 500 });
  }
  if (!events.length) {
    return NextResponse.json({ sent: 0, message: "Gönderilecek hatırlatma yok." });
  }

  let sentCount = 0;
  const siteUrl = getSiteUrl();

  for (const event of events) {
    const { data: reminders } = await supabase
      .from("event_reminders")
      .select("id, email")
      .eq("event_id", event.id)
      .is("reminder_sent_at", null);

    if (!reminders?.length) continue;

    const eventUrl = `${siteUrl}/etkinlik/${event.slug || event.id}`;

    for (const r of reminders) {
      const result = await sendReminderEmail({
        email: r.email,
        eventTitle: event.title,
        eventDate: event.date,
        eventTime: event.time || "—",
        venue: event.venue || "—",
        eventUrl,
      });

      if (result.sent) {
        await supabase
          .from("event_reminders")
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq("id", r.id);
        sentCount++;
      } else {
        console.error("Reminder email failed:", r.email, result.reason);
      }
    }
  }

  return NextResponse.json({ sent: sentCount, message: `${sentCount} hatırlatma gönderildi.` });
}
