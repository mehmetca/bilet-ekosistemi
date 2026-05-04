import * as Sentry from "@sentry/nextjs";

function isBenignDomDetachErrorText(value: unknown): boolean {
  const message = String(value || "").toLowerCase();
  return (
    message.includes("failed to execute 'removechild' on 'node'") ||
    (message.includes("removechild") && message.includes("not a child of this node"))
  );
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  ignoreErrors: [
    "NEXT_REDIRECT",
    "NEXT_NOT_FOUND",
    "Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.",
  ],
  beforeSend(event, hint) {
    const err = hint?.originalException;
    if (err && typeof err === "object" && "type" in err && (err as Event).type === "error") {
      return null;
    }
    if (
      isBenignDomDetachErrorText(err instanceof Error ? err.message : err) ||
      event.exception?.values?.some((value) =>
        isBenignDomDetachErrorText(value.value || value.type)
      )
    ) {
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
