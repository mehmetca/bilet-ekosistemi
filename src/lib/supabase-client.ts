import { createClient } from "@supabase/supabase-js";

const isBrowser = typeof window !== "undefined";

const storageAdapter = {
  getItem: (key: string) => {
    if (!isBrowser) return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    if (!isBrowser) return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
    }
  },
  removeItem: (key: string) => {
    if (!isBrowser) return;
    try {
      window.localStorage.removeItem(key);
    } catch {
    }
  },
};

// Custom lock implementation to bypass Navigator Lock Manager issues
const customLock = async (name: string, acquireTimeout: number, fn: () => Promise<any>) => {
  return fn();
};

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      debug: false,
      flowType: "pkce",
      storage: storageAdapter,
      // @ts-ignore
      lock: customLock,
    },
    db: {
      schema: "public",
    },
    global: {
      headers: {
        "X-Client-Info": "bilet-ekosistemi/1.0.0",
      },
    },
  }
);
