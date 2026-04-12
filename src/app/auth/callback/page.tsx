"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser-client";

/**
 * OAuth PKCE: kod değişimi tarayıcıda yapılır — sunucu route'unda çerez/PKCE eşleşmemesi
 * (özellikle çoklu domain) nedeniyle exchangeCodeForSession bazen başarısız oluyordu.
 */
function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  let next = searchParams.get("next") ?? "/";
  if (!next.startsWith("/")) next = "/";
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    let cancelled = false;

    (async () => {
      if (!code) {
        router.replace("/giris");
        return;
      }

      const sb = createSupabaseBrowserClient();

      const finish = async (userId: string) => {
        let finalPath = next;
        if (userId) {
          const { data: roleData } = await sb
            .from("user_roles")
            .select("role")
            .eq("user_id", userId)
            .limit(1)
            .maybeSingle();
          if (cancelled) return;
          const role = roleData?.role as string | undefined;
          const hasManagementRole =
            role === "admin" || role === "controller" || role === "organizer";
          if (hasManagementRole && next === "/") {
            finalPath = "/yonetim";
          }
        }
        router.replace(finalPath);
      };

      const { data, error } = await sb.auth.exchangeCodeForSession(code);

      if (cancelled) return;

      if (!error && data.session?.user) {
        await finish(data.session.user.id);
        return;
      }

      if (error) {
        console.error("[auth/callback] exchangeCodeForSession:", error.message);
      }

      const { data: sessionData } = await sb.auth.getSession();
      if (sessionData.session?.user) {
        await finish(sessionData.session.user.id);
        return;
      }

      router.replace("/giris?error=oauth");
    })();

    return () => {
      cancelled = true;
    };
  }, [code, next, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
      <p className="text-sm">Giriş tamamlanıyor…</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
          <p className="text-sm">Giriş tamamlanıyor…</p>
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
