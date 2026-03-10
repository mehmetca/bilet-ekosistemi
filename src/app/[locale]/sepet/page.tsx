"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useCart } from "@/context/CartContext";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { supabase } from "@/lib/supabase-client";
import Header from "@/components/Header";
import { Link, useRouter } from "@/i18n/navigation";
import { formatPrice } from "@/lib/formatPrice";
import { ShoppingCart, Trash2, Calendar, MapPin, Ticket, ChevronRight, CreditCard, Lock } from "lucide-react";
import TicketPrint from "@/components/TicketPrint";

const dateLocaleMap = { tr: "tr-TR", de: "de-DE", en: "en-US" } as const;

export default function CheckoutPage() {
  const t = useTranslations("checkout");
  const tEvent = useTranslations("eventDetail");
  const locale = useLocale() as "tr" | "de" | "en";
  const dateLocale = dateLocaleMap[locale] || "tr-TR";
  const router = useRouter();
  const { user, loading: authLoading } = useSimpleAuth();

  const { items, removeItem, updateQuantity, updateItemAvailable, clearCart, totalPrice } = useCart();
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [buyerPlz, setBuyerPlz] = useState("");
  const [buyerCity, setBuyerCity] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardHolderName, setCardHolderName] = useState("");

  // Giriş yapmış kullanıcının profilini çek ve alanları doldur (adres dahil)
  useEffect(() => {
    if (!user) return;
    if (user.email) setBuyerEmail((prev) => (prev === "" ? user.email : prev));
    async function loadProfile() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch("/api/profile", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const profile = (await res.json()) as {
            first_name?: string | null;
            last_name?: string | null;
            email?: string | null;
            address?: string | null;
            plz?: string | null;
            city?: string | null;
          };
          if (profile) {
            const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
            if (fullName) setBuyerName((prev) => (prev === "" ? fullName : prev));
            if (profile.email) setBuyerEmail((prev) => (prev === "" ? profile.email! : prev));
            if (profile.address) setBuyerAddress((prev) => (prev === "" ? profile.address! : prev));
            if (profile.plz) setBuyerPlz((prev) => (prev === "" ? profile.plz! : prev));
            if (profile.city) setBuyerCity((prev) => (prev === "" ? profile.city! : prev));
          }
        }
      } catch {
        /* ignore */
      }
    }
    loadProfile();
  }, [user, user?.email]);
  const [currentStep, setCurrentStep] = useState(1);
  const [isPending, setIsPending] = useState(false);

  // Sepet açıldığında güncel stok bilgisini çek; stoktan fazla adet varsa stoka indir
  useEffect(() => {
    if (items.length === 0) return;
    const ticketIds = [...new Set(items.map((i) => i.ticketId))];
    void (async () => {
      try {
        const { data } = await supabase
          .from("tickets")
          .select("id, available")
          .in("id", ticketIds);
        if (!data) return;
        for (const row of data as { id: string; available: number }[]) {
          updateItemAvailable(row.id, Number(row.available ?? 0));
        }
      } catch {
        /* ignore */
      }
    })();
  }, [items.length, updateItemAvailable]);
  const [results, setResults] = useState<
    Array<{
      success: boolean;
      ticketCode?: string;
      message: string;
      emailSent?: boolean;
      orderDetails?: { buyerName: string; quantity: number; ticketType: string; price: number };
    }>
  >([]);
  const [completedItems, setCompletedItems] = useState<typeof items>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleCompleteOrder(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) return;
    const finalEmail = (buyerEmail.trim() || user?.email || "").trim();
    const finalName = buyerName.trim() || (user?.email ? user.email.split("@")[0] : "") || "Müşteri";
    if (!user) {
      if (!buyerName.trim() || !buyerEmail.trim()) {
        setError(tEvent("nameEmailRequired"));
        return;
      }
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!finalEmail || !emailRegex.test(finalEmail)) {
      setError("Geçerli bir e-posta adresi girin.");
      return;
    }
    if (!cardNumber.trim() || !cardExpiry.trim() || !cardCvc.trim() || !cardHolderName.trim()) {
      setError(t("cardFieldsRequired"));
      return;
    }
    setError(null);
    setIsPending(true);
    const orderResults: typeof results = [];

    try {
      let { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token && user) {
        await supabase.auth.refreshSession();
        const r = await supabase.auth.getSession();
        session = r.data.session;
      }
      const headers: Record<string, string> = {};
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      for (const item of items) {
        const formData = new FormData();
        formData.append("ticket_id", item.ticketId);
        formData.append("quantity", String(item.quantity));
        formData.append("buyer_name", finalName);
        formData.append("buyer_email", finalEmail);
        if (buyerAddress.trim()) formData.append("buyer_address", buyerAddress.trim());
        if (buyerPlz.trim()) formData.append("buyer_plz", buyerPlz.trim());
        if (buyerCity.trim()) formData.append("buyer_city", buyerCity.trim());

        const res = await fetch("/api/purchase", {
          method: "POST",
          headers,
          body: formData,
        });
        const data = await res.json();

        if (data.success) {
          orderResults.push({
            success: true,
            ticketCode: data.ticketCode,
            message: data.message,
            emailSent: data.emailSent !== false,
            orderDetails: {
              buyerName: finalName,
              quantity: item.quantity,
              ticketType: item.ticketName,
              price: item.price * item.quantity,
            },
          });
        } else {
          orderResults.push({
            success: false,
            message: data.message || tEvent("purchaseError"),
          });
        }
      }

      setResults(orderResults);
      const allSuccess = orderResults.every((r) => r.success);
      if (allSuccess) {
        setCompletedItems([...items]);
        clearCart();
      }
    } catch {
      setError(tEvent("purchaseError"));
    } finally {
      setIsPending(false);
    }
  }

  // Giriş yapmamış kullanıcı: 3 sn sonra giriş sayfasına yönlendir (Eventim tarzı)
  useEffect(() => {
    if (authLoading || items.length === 0 || results.length > 0 || user) return;
    const timer = setTimeout(() => router.replace(`/giris?redirect=/${locale}/sepet`), 3000);
    return () => clearTimeout(timer);
  }, [user, authLoading, items.length, results.length, router, locale]);

  const allSuccess = results.length > 0 && results.every((r) => r.success);

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <Header />

      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Progress steps - Eventim style */}
        <div className="mb-10 flex items-center justify-center gap-2 sm:gap-4">
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            className="flex items-center gap-2 text-left"
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
                currentStep >= 1 ? "!bg-blue-600 text-white" : "bg-slate-200 text-slate-600"
              }`}
            >
              1
            </div>
            <span className={`text-sm font-semibold ${currentStep >= 1 ? "text-slate-900" : "text-slate-500"}`}>
              {t("stepCart")}
            </span>
          </button>
          <ChevronRight className="h-5 w-5 text-slate-400" />
          <button
            type="button"
            onClick={() => currentStep >= 2 && setCurrentStep(2)}
            className="flex items-center gap-2 text-left disabled:cursor-not-allowed"
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
                currentStep >= 2 ? "!bg-blue-600 text-white" : "bg-slate-200 text-slate-600"
              }`}
            >
              2
            </div>
            <span className={`text-sm font-medium ${currentStep >= 2 ? "text-slate-900" : "text-slate-500"}`}>
              {t("stepDelivery")}
            </span>
          </button>
          <ChevronRight className="h-5 w-5 text-slate-400" />
          <button
            type="button"
            onClick={() => currentStep >= 3 && setCurrentStep(3)}
            className="flex items-center gap-2 text-left disabled:cursor-not-allowed"
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
                currentStep >= 3 ? "!bg-blue-600 text-white" : "bg-slate-200 text-slate-600"
              }`}
            >
              3
            </div>
            <span className={`text-sm font-medium ${currentStep >= 3 ? "text-slate-900" : "text-slate-500"}`}>
              {t("stepPayment")}
            </span>
          </button>
        </div>

        <h1 className="mb-8 text-2xl font-bold text-slate-900 md:text-3xl">{t("title")}</h1>

        {!user && !authLoading && items.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
            <p className="mb-6 text-lg text-slate-700">{t("loginRequired")}</p>
            <p className="mb-6 text-sm text-slate-500">{t("redirectingToLogin")}</p>
            <Link
              href={`/giris?redirect=/${locale}/sepet`}
              className="inline-flex items-center gap-2 rounded-lg !bg-blue-600 px-6 py-3 font-semibold text-white hover:!bg-blue-700"
            >
              {t("loginOrSignup")}
            </Link>
          </div>
        ) : allSuccess ? (
          <div className="space-y-6">
            {results.some((r) => r.success && !r.emailSent) && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
                <p className="font-medium">{t("emailNotSent")}</p>
                <p className="mt-1 text-sm">{t("emailNotSentHint")}</p>
              </div>
            )}
            {results.map((r, idx) =>
              r.success && r.ticketCode && r.orderDetails ? (
                <div
                  key={idx}
                  className="rounded-xl border border-green-200 bg-green-50 p-6"
                >
                  <p className="mb-4 font-medium text-green-800">{r.message}</p>
                  <TicketPrint
                    ticketCode={r.ticketCode}
                    buyerName={r.orderDetails.buyerName}
                    quantity={r.orderDetails.quantity}
                    ticketType={r.orderDetails.ticketType}
                    price={r.orderDetails.price}
                    currency={completedItems[idx]?.currency as import("@/types/database").EventCurrency | undefined}
                    eventTitle={completedItems[idx]?.eventTitle}
                    eventDate={completedItems[idx]?.eventDate}
                    eventTime={completedItems[idx]?.eventTime}
                    venue={completedItems[idx]?.venue}
                    location={completedItems[idx]?.location}
                  />
                </div>
              ) : null
            )}
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg !bg-blue-600 px-6 py-3 font-semibold text-white hover:!bg-blue-700"
            >
              {t("continueShopping")}
            </Link>
          </div>
        ) : items.length === 0 && results.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
            <ShoppingCart className="mx-auto mb-4 h-16 w-16 text-slate-300" />
            <h2 className="mb-2 text-xl font-semibold text-slate-800">{t("emptyCart")}</h2>
            <p className="mb-6 text-slate-600">{t("emptyCartDesc")}</p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg !bg-blue-600 px-6 py-3 font-semibold text-white hover:!bg-blue-700"
            >
              {t("continueShopping")}
            </Link>
          </div>
        ) : (
          <div className={currentStep === 3 ? "grid gap-8 lg:grid-cols-[1fr_360px] lg:items-start" : "space-y-6"}>
            {/* Adım 1: Sepet */}
            {currentStep === 1 && (
              <div className="space-y-4">
                {items.map((item) => (
                <div
                  key={item.ticketId}
                  className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  {item.imageUrl && (
                    <div className="relative h-20 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-slate-900">{item.eventTitle}</h3>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(item.eventDate).toLocaleDateString(dateLocale)} • {item.eventTime}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {item.venue}, {item.location}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Ticket className="h-4 w-4 text-primary-600" />
                      <span className="text-sm font-medium text-slate-700">{item.ticketName}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.ticketId, item.quantity - 1)}
                        className="h-8 w-8 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.ticketId, item.quantity + 1)}
                        disabled={item.quantity >= item.available}
                        className="h-8 w-8 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        +
                      </button>
                    </div>
                    <p className="text-lg font-bold text-primary-700">
                      {formatPrice(item.price * item.quantity, item.currency as import("@/types/database").EventCurrency | undefined)}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeItem(item.ticketId)}
                      className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t("remove")}
                    </button>
                  </div>
                </div>
              ))}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="inline-flex items-center gap-2 rounded-lg !bg-blue-600 px-6 py-3 font-semibold text-white hover:!bg-blue-700"
                  >
                    {t("stepContinue")}
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}

            {/* Adım 2: Teslimat */}
            {currentStep === 2 && (
              <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <h2 className="mb-4 text-lg font-bold text-slate-900">{t("deliveryMethod")}</h2>
                <div className="flex items-start gap-3 rounded-lg border-2 border-blue-500 bg-blue-50 p-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                    <Ticket className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{t("eTicket")}</p>
                    <p className="mt-1 text-sm text-slate-600">{t("eTicketDesc")}</p>
                  </div>
                </div>
              </div>
                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {t("stepBack")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="inline-flex items-center gap-2 rounded-lg !bg-blue-600 px-6 py-3 font-semibold text-white hover:!bg-blue-700"
                  >
                    {t("stepContinue")}
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}

            {/* Adım 3: Ödeme bilgileri + Müşteri bilgileri + Sipariş özeti */}
            {currentStep === 3 && (
              <>
              <div className="space-y-4">
              {/* Kredi kartı - üstte */}
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <h2 className="mb-4 text-lg font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-slate-600" />
                  {t("paymentDetails")}
                </h2>
                <p className="mb-4 flex items-center gap-2 text-sm text-slate-600">
                  <Lock className="h-4 w-4" />
                  {t("securePayment")}
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      {t("cardNumber")}
                    </label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 19);
                        setCardNumber(v.replace(/(\d{4})(?=\d)/g, "$1 "));
                      }}
                      placeholder="1234 5678 9012 3456"
                      className="w-full rounded-lg border border-slate-300 px-4 py-2.5 font-mono focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        {t("cardExpiry")}
                      </label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={(e) => {
                          let v = e.target.value.replace(/\D/g, "").slice(0, 4);
                          if (v.length >= 2) v = v.slice(0, 2) + "/" + v.slice(2);
                          setCardExpiry(v);
                        }}
                        placeholder="MM/YY"
                        className="w-full rounded-lg border border-slate-300 px-4 py-2.5 font-mono focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        {t("cardCvc")}
                      </label>
                      <input
                        type="text"
                        value={cardCvc}
                        onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        placeholder="123"
                        className="w-full rounded-lg border border-slate-300 px-4 py-2.5 font-mono focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      {t("cardHolderName")}
                    </label>
                    <input
                      type="text"
                      value={cardHolderName}
                      onChange={(e) => setCardHolderName(e.target.value)}
                      placeholder={t("cardHolderPlaceholder")}
                      className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-500">{t("testModeHint")}</p>
              </div>

              {/* Müşteri bilgileri - altta */}
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <h2 className="mb-4 text-lg font-bold text-slate-900">{t("customerInfo")}</h2>
                {user ? (
                  <div className="mb-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
                    <p><span className="font-medium">{t("fullName")}:</span> {buyerName || user.email?.split("@")[0] || "—"}</p>
                    <p className="mt-1"><span className="font-medium">{t("email")}:</span> {buyerEmail || user.email || "—"}</p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        {t("fullName")}
                      </label>
                      <input
                        type="text"
                        value={buyerName}
                        onChange={(e) => setBuyerName(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        placeholder={tEvent("fullNamePlaceholder")}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        {t("email")}
                      </label>
                      <input
                        type="email"
                        value={buyerEmail}
                        onChange={(e) => setBuyerEmail(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        placeholder={tEvent("reminderPlaceholder")}
                      />
                    </div>
                  </div>
                )}
                <p className="mt-3 text-xs text-slate-500">{t("addressHint")}</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-slate-600">
                      {t("addressOptional")}
                    </label>
                    <input
                      type="text"
                      value={buyerAddress}
                      onChange={(e) => setBuyerAddress(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                      placeholder={t("address")}
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={buyerPlz}
                      onChange={(e) => setBuyerPlz(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                      placeholder={t("plz")}
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={buyerCity}
                      onChange={(e) => setBuyerCity(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                      placeholder={t("city")}
                    />
                  </div>
                </div>
                {user && !buyerAddress && !buyerPlz && !buyerCity && (
                  <p className="mt-2 text-xs text-primary-600">
                    <Link href="/bilgilerim" className="underline hover:no-underline">
                      {t("fillFromProfile")}
                    </Link>
                  </p>
                )}
              </div>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {t("stepBack")}
                </button>
              </div>
            </div>

            {/* Sağ: Sipariş özeti - sticky */}
            <div className="lg:sticky lg:top-24">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-6 text-lg font-bold text-slate-900">{t("yourOrder")}</h2>
                <div className="space-y-3 border-b border-slate-200 pb-4">
                  <div className="flex justify-between text-slate-600">
                    <span>{t("subtotal")}</span>
                    <span>{formatPrice(totalPrice, items[0]?.currency as import("@/types/database").EventCurrency | undefined)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>{t("fees")}</span>
                    <span>0,00 €</span>
                  </div>
                </div>
                <div className="mt-4 flex justify-between text-lg font-bold text-slate-900">
                  <span>{t("total")}</span>
                  <span className="text-primary-700">{formatPrice(totalPrice, items[0]?.currency as import("@/types/database").EventCurrency | undefined)}</span>
                </div>

                {error && (
                  <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </p>
                )}

                {results.some((r) => !r.success) && (
                  <div className="mt-4 space-y-2">
                    {results.filter((r) => !r.success).map((r, i) => (
                      <p key={i} className="text-sm text-red-600">
                        {r.message}
                      </p>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleCompleteOrder(e as unknown as React.FormEvent);
                  }}
                  disabled={isPending || items.length === 0 || !user}
                  className="mt-6 w-full rounded-lg !bg-blue-600 py-4 font-semibold text-white transition-colors hover:!bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500"
                >
                  {isPending ? t("processing") : t("completeOrder")}
                </button>
              </div>
            </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
