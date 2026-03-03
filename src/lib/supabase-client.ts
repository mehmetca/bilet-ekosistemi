import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

const customLock = async (_name: string, _acquireTimeout: number, fn: () => Promise<unknown>) => {
  return fn();
};

let _client: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("supabaseUrl is required. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel Environment Variables.");
  }
  _client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      debug: false,
      flowType: "pkce",
      storage: storageAdapter,
      // @ts-expect-error custom lock type
      lock: customLock,
    },
    db: { schema: "public" },
    global: { headers: { "X-Client-Info": "bilet-ekosistemi/1.0.0" } },
  });
  return _client;
}

/** Lazy Supabase client: oluşturma ilk kullanımda yapılır (build/runtime'ta env yoksa hata önlenir). */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop: string) {
    const target = getSupabaseClient() as unknown as Record<string, unknown>;
    const val = target[prop];
    return typeof val === "function" ? (val as (...args: unknown[]) => unknown).bind(target) : val;
  },
});
