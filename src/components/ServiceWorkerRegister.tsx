"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      // Disable SW to prevent stale cached HTML/CSS causing broken UI.
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister()))
        )
        .catch((error) => {
          console.error("Service Worker unregister failed:", error);
        });

      if ("caches" in window) {
        caches
          .keys()
          .then((keys) =>
            Promise.all(keys.map((key) => caches.delete(key)))
          )
          .catch((error) => {
            console.error("Cache cleanup failed:", error);
          });
      }
    }
  }, []);

  return null;
}
