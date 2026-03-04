import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  beforeSend(event, hint) {
    const err = hint?.originalException;
    if (err && typeof err === "object" && "type" in err && (err as Event).type === "error") {
      return null;
    }
    return event;
  },
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      maskAllInputs: true,
    }),
  ],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
