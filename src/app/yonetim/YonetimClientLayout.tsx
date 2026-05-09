"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { LogOut, Menu, X } from "lucide-react";
import AdminGuard from "@/components/AdminGuard";
import AdminNavigationFixed from "@/components/AdminNavigationFixed";
import AdminPolicyHeader from "@/components/AdminPolicyHeader";
import Footer from "@/components/Footer";
import OrganizerLayout from "@/components/OrganizerLayout";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { usePathname, useRouter } from "next/navigation";

export default function YonetimClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, isOrganizer, isController, loading, signOut } = useSimpleAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [controllerNavOpen, setControllerNavOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!isController) return;
    if (pathname?.startsWith("/yonetim/bilet-kontrol")) return;
    router.replace("/yonetim/bilet-kontrol");
  }, [loading, isController, pathname, router]);

  useEffect(() => {
    if (pathname?.startsWith("/yonetim/bilet-kontrol")) {
      setControllerNavOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    if ((sidebarOpen || controllerNavOpen) && mobile) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen, controllerNavOpen]);

  async function handleControllerSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      router.push("/giris");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  function isControllerNavActive(href: string) {
    const p = pathname ?? "";
    if (href === "/") return p === "/";
    if (href === "/yonetim/bilet-kontrol/kullanim-klavuzu") return p.startsWith(href);
    if (href === "/yonetim/bilet-kontrol") {
      return p.startsWith("/yonetim/bilet-kontrol") && !p.startsWith("/yonetim/bilet-kontrol/kullanim");
    }
    return false;
  }

  function controllerNavLinkClass(href: string) {
    const active = isControllerNavActive(href);
    return [
      "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
      active
        ? "bg-primary-50 text-primary-800"
        : "text-slate-700 hover:bg-slate-100",
    ].join(" ");
  }

  function ControllerSidebar({ onNavigate }: { onNavigate?: () => void }) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-slate-100 px-3 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Kontrolör</p>
          {user?.email ? (
            <p className="mt-1 truncate text-xs text-slate-600" title={user.email}>
              {user.email}
            </p>
          ) : null}
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          <Link
            href="/yonetim/bilet-kontrol"
            className={controllerNavLinkClass("/yonetim/bilet-kontrol")}
            onClick={onNavigate}
          >
            Bilet kontrol
          </Link>
          <Link
            href="/yonetim/bilet-kontrol/kullanim-klavuzu"
            className={controllerNavLinkClass("/yonetim/bilet-kontrol/kullanim-klavuzu")}
            onClick={onNavigate}
          >
            Kullanım kılavuzu
          </Link>
          <Link href="/" className={controllerNavLinkClass("/")} onClick={onNavigate}>
            Ana sayfa
          </Link>
        </nav>
        <div className="border-t border-slate-100 p-2">
          <button
            type="button"
            onClick={() => void handleControllerSignOut()}
            disabled={signingOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-red-50 hover:text-red-800 disabled:opacity-50"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {signingOut ? "Çıkılıyor…" : "Çıkış yap"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <AdminGuard>
      {!loading && isController ? (
        <div className="flex min-h-screen bg-slate-50">
          <aside className="relative z-10 hidden w-56 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
            <ControllerSidebar />
          </aside>

          {controllerNavOpen ? (
            <div
              className="fixed inset-0 z-40 bg-slate-900/40 md:hidden"
              aria-hidden
              onClick={() => setControllerNavOpen(false)}
            />
          ) : null}
          <aside
            className={[
              "fixed inset-y-0 left-0 z-50 flex w-[min(17rem,88vw)] flex-col border-r border-slate-200 bg-white shadow-xl transition-transform duration-200 md:hidden",
              controllerNavOpen ? "translate-x-0" : "-translate-x-full",
            ].join(" ")}
          >
            <div className="flex items-center justify-end border-b border-slate-100 p-2">
              <button
                type="button"
                onClick={() => setControllerNavOpen(false)}
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
                aria-label="Menüyü kapat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ControllerSidebar onNavigate={() => setControllerNavOpen(false)} />
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 md:hidden">
              <button
                type="button"
                onClick={() => setControllerNavOpen(true)}
                className="rounded-lg p-2 text-slate-700 hover:bg-slate-100"
                aria-label="Menüyü aç"
              >
                <Menu className="h-5 w-5" />
              </button>
              <span className="truncate text-sm font-semibold text-slate-900">Bilet kontrol</span>
            </header>
            <div className="flex-1 overflow-auto">
              <Suspense fallback={<div className="flex items-center justify-center py-16 text-slate-500">Yükleniyor...</div>}>
                {children}
              </Suspense>
            </div>
          </div>
        </div>
      ) : !loading && isOrganizer ? (
        <OrganizerLayout>
          <Suspense fallback={<div className="flex items-center justify-center py-16 text-slate-500">Yükleniyor...</div>}>
            {children}
          </Suspense>
        </OrganizerLayout>
      ) : (
        <div className="flex min-h-screen bg-slate-50">
          <AdminNavigationFixed isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <AdminPolicyHeader onMenuClick={() => setSidebarOpen(true)} />
            <div className="flex-1 overflow-auto">
              <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-slate-500">Yükleniyor...</div>}>
                {children}
              </Suspense>
            </div>
            <Footer />
          </div>
        </div>
      )}
    </AdminGuard>
  );
}
