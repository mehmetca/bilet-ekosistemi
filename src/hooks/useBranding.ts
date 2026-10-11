"use client";

import { useEffect, useState } from "react";
import { DEFAULT_BRANDING, normalizeBranding, type Branding } from "@/lib/branding";

let cached: Branding | null = null;
let pending: Promise<Branding> | null = null;

function loadBranding(): Promise<Branding> {
  if (cached) return Promise.resolve(cached);
  if (!pending) {
    pending = fetch("/api/branding/")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        cached = normalizeBranding(json);
        return cached;
      })
      .catch(() => {
        cached = { ...DEFAULT_BRANDING };
        return cached;
      });
  }
  return pending;
}

/** Header/Footer aynı marka değerini tek istekle okusun; panel kaydı sonrası sayfa yenilenince yansır. */
export function useBranding(): Branding {
  const [branding, setBranding] = useState<Branding>(cached ?? DEFAULT_BRANDING);

  useEffect(() => {
    let active = true;
    void loadBranding().then((value) => {
      if (active) setBranding(value);
    });
    return () => {
      active = false;
    };
  }, []);

  return branding;
}
