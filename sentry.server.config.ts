import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Next.js redirect() ve notFound() özel hata fırlatır; bunları raporlama
  ignoreErrors: ["NEXT_REDIRECT", "NEXT_NOT_FOUND"],
  // OpenTelemetry vendor-chunks hatasını önlemek için development'ta tracing kapatıldı
  tracesSampleRate: process.env.NODE_ENV === "development" ? 0 : 0.1,
});
