"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useCart } from "@/context/CartContext";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { supabase } from "@/lib/supabase-client";
import Header from "@/components/Header";
import { Link, useRouter } from "@/i18n/navigation";
import { formatPrice } from "@/lib/formatPrice";
import { formatEventDateDMY, formatCartEventWhen } from "@/lib/date-utils";
import {
  ShoppingCart,
  Trash2,
  Calendar,
  MapPin,
  Ticket,
  ChevronRight,
  CreditCard,
  Lock,
  Mail,
  Truck,
  Zap,
  Clock,
  ArrowLeft,
  ArrowUp,
} from "lucide-react";
import {
  shippingFeeForPhysicalDelivery,
  type CheckoutPhysicalDelivery,
} from "@/lib/checkout-shipping";
import {
  CART_EXPIRED_FLAG_KEY,
  CART_EXPIRED_SNAPSHOT_KEY,
  type CartExpiredSnapshot,
} from "@/lib/cart-reservation";
import TicketPrint from "@/components/TicketPrint";

export default function CheckoutPage() {
  const t = useTranslations("checkout");
  const tEvent = useTranslations("eventDetail");
  const locale = useLocale() as "tr" | "de" | "en";
  const router = useRouter();
  const { user, loading: authLoading, accessToken: authAccessToken } = useSimpleAuth();

  const {
    items,
    removeItem,
    updateQuantity,
    updateItemAvailable,
    clearCart,
    totalPrice,
    totalItems,
    reservationExpiresAt,
  } = useCart();
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [buyerPlz, setBuyerPlz] = useState("");
  const [buyerCity, setBuyerCity] = useState("");
  const [seatHoldSessionId, setSeatHoldSessionId] = useState<string | null>(null);
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
  /** e_ticket = yalnızca e-posta/PDF; standard | express = basılı gönderim + kargo ücreti (checkout’ta bir kez). */
  const [deliveryChoice, setDeliveryChoice] = useState<"e_ticket" | "standard" | "express">("e_ticket");
  const [step2AddressError, setStep2AddressError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [resTick, setResTick] = useState(0);
  const [showReservationExpired, setShowReservationExpired] = useState(false);
  const [expiredSnapshot, setExpiredSnapshot] = useState<CartExpiredSnapshot | null>(null);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && sessionStorage.getItem(CART_EXPIRED_FLAG_KEY) === "1") {
        const raw = sessionStorage.getItem(CART_EXPIRED_SNAPSHOT_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as CartExpiredSnapshot;
          if (parsed?.eventId) setExpiredSnapshot(parsed);
        }
        setShowReservationExpired(true);
        sessionStorage.removeItem(CART_EXPIRED_FLAG_KEY);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (items.length > 0) {
      setShowReservationExpired(false);
      setExpiredSnapshot(null);
      try {
        sessionStorage.removeItem(CART_EXPIRED_SNAPSHOT_KEY);
      } catch {
        /* ignore */
      }
    }
  }, [items.length]);

  useEffect(() => {
    if (!reservationExpiresAt || items.length === 0) return;
    const id = window.setInterval(() => setResTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [reservationExpiresAt, items.length]);

  const reservationSecLeft =
    reservationExpiresAt && items.length > 0
      ? Math.max(0, Math.ceil((reservationExpiresAt - Date.now()) / 1000))
      : 0;
  const reservationTimeStr =
    reservationSecLeft > 0
      ? `${Math.floor(reservationSecLeft / 60)}:${String(reservationSecLeft % 60).padStart(2, "0")}`
      : "0:00";

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
      orderDetails?: {
        buyerName: string;
        quantity: number;
        ticketType: string;
        price: number;
        seatDetails?: Array<{ section_name: string; row_label: string; seat_label: string }>;
      };
    }>
  >([]);
  const [completedItems, setCompletedItems] = useState<typeof items>([]);
  const [error, setError] = useState<string | null>(null);

  const processingFeesTotal = useMemo(() => {
    const byEvent = new Map<string, number>();
    for (const i of items) {
      const f = i.eventCheckoutFee;
      if (f != null && f > 0 && !byEvent.has(i.eventId)) byEvent.set(i.eventId, f);
    }
    let sum = 0;
    for (const v of byEvent.values()) sum += v;
    return sum;
  }, [items]);

  const checkoutCurrency = items[0]?.currency as import("@/types/database").EventCurrency | undefined;

  const physicalDeliveryForCheckout: CheckoutPhysicalDelivery =
    deliveryChoice === "e_ticket" ? "none" : deliveryChoice;
  const shippingFeeOnce = shippingFeeForPhysicalDelivery(physicalDeliveryForCheckout);

  const grandTotal = totalPrice + processingFeesTotal + shippingFeeOnce;
  const subtotalUntilShipping = totalPrice + processingFeesTotal;
  const displayGrandTotal =
    currentStep === 1 ? subtotalUntilShipping : grandTotal;

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
    if (shippingFeeOnce > 0) {
      if (!buyerAddress.trim() || !buyerPlz.trim() || !buyerCity.trim()) {
        setError(t("addressRequiredShipping"));
        return;
      }
    }
    setError(null);
    setIsPending(true);
    const orderResults: typeof results = [];

    try {
      let token = authAccessToken;
      if (!token) {
        let { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token && user) {
          await supabase.auth.refreshSession();
          const r = await supabase.auth.getSession();
          session = r.data.session;
        }
        token = session?.access_token ?? null;
      }
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const feeChargedForEventId = new Set<string>();
      let shippingApplied = false;
      for (const item of items) {
        const formData = new FormData();
        formData.append("ticket_id", item.ticketId);
        const seatIdsAligned =
          item.seatIds && item.seatIds.length > 0
            ? item.seatIds.slice(0, Math.min(item.seatIds.length, item.quantity))
            : [];
        const purchaseQty = seatIdsAligned.length > 0 ? seatIdsAligned.length : item.quantity;
        formData.append("quantity", String(purchaseQty));
        formData.append("buyer_name", finalName);
        formData.append("buyer_email", finalEmail);
        if (user?.id) formData.append("client_user_id", user.id);
        if (buyerAddress.trim()) formData.append("buyer_address", buyerAddress.trim());
        if (buyerPlz.trim()) formData.append("buyer_plz", buyerPlz.trim());
        if (buyerCity.trim()) formData.append("buyer_city", buyerCity.trim());
        const shouldApplyShippingForThisItem =
          !shippingApplied && physicalDeliveryForCheckout !== "none";
        formData.append(
          "physical_delivery",
          shouldApplyShippingForThisItem ? physicalDeliveryForCheckout : "none"
        );
        if (seatIdsAligned.length > 0) {
          formData.append("seat_ids", JSON.stringify(seatIdsAligned));
          if (seatHoldSessionId) {
            formData.append("seat_hold_session_id", seatHoldSessionId);
          }
        }
        const fee = item.eventCheckoutFee;
        const shouldApplyProcessingFee =
          fee != null && fee > 0 && !feeChargedForEventId.has(item.eventId);
        if (shouldApplyProcessingFee) {
          formData.append("include_checkout_processing_fee", "true");
        }

        const res = await fetch("/api/purchase", {
          method: "POST",
          headers,
          body: formData,
        });
        const data = await res.json();

        if (data.success) {
          if (shouldApplyShippingForThisItem) shippingApplied = true;
          if (shouldApplyProcessingFee) feeChargedForEventId.add(item.eventId);
          const od = data.orderDetails as
            | { price?: number; seatDetails?: Array<{ section_name: string; row_label: string; seat_label: string }> }
            | undefined;
          orderResults.push({
            success: true,
            ticketCode: data.ticketCode,
            message: data.message,
            emailSent: data.emailSent !== false,
            orderDetails: {
              buyerName: finalName,
              quantity: purchaseQty,
              ticketType: item.ticketName,
              price: typeof od?.price === "number" ? od.price : item.price * purchaseQty,
              seatDetails: od?.seatDetails,
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

  // Giriş yapmamış kullanıcı: 3 sn sonra giriş sayfasına yönlendir (EventSeat akışı)
  useEffect(() => {
    if (authLoading || items.length === 0 || results.length > 0 || user) return;
    const timer = setTimeout(() => router.replace(`/giris?redirect=/${locale}/sepet`), 3000);
    return () => clearTimeout(timer);
  }, [user, authLoading, items.length, results.length, router, locale]);

  useEffect(() => {
    try {
      setSeatHoldSessionId(window.localStorage.getItem("seatHoldSessionId"));
    } catch {
      setSeatHoldSessionId(null);
    }
  }, []);

  const allSuccess = results.length > 0 && results.every((r) => r.success);

  const clearExpiredSession = () => {
    setShowReservationExpired(false);
    setExpiredSnapshot(null);
    try {
      sessionStorage.removeItem(CART_EXPIRED_SNAPSHOT_KEY);
    } catch {
      /* ignore */
    }
  };

  const showExpiredFullPage =
    showReservationExpired && items.length === 0 && results.length === 0 && !allSuccess;

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <Header />

      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Progress steps – ödeme adımları */}
        {!showExpiredFullPage ? (
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
        ) : null}

        {!showExpiredFullPage ? (
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">{t("title")}</h1>
          {items.length > 0 ? (
            <p className="text-base font-semibold text-primary-600 md:text-lg">
              {t("cartHeadlineSummary", {
                count: totalItems,
                total: formatPrice(displayGrandTotal, checkoutCurrency),
              })}
            </p>
          ) : null}
        </div>
        ) : null}

        {!showExpiredFullPage && items.length > 0 && reservationExpiresAt && reservationSecLeft > 0 ? (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-950 shadow-sm">
            <Clock className="h-6 w-6 shrink-0 text-emerald-700" aria-hidden />
            <p className="text-sm font-semibold sm:text-base">
              {t("reservationTimer", { time: reservationTimeStr })}
            </p>
          </div>
        ) : null}

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
                    seatDetails={r.orderDetails.seatDetails}
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
          showExpiredFullPage ? (
            <div className="pb-10">
              <Link
                href="/"
                onClick={clearExpiredSession}
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 hover:text-primary-800"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                {t("backToShop")}
              </Link>
              <div className="mt-10 text-center px-2">
                <h2 className="text-2xl font-bold text-primary-800 md:text-3xl">
                  {t("reservationExpiredPageTitle")}
                </h2>
                <p className="mt-3 max-w-lg mx-auto text-base text-slate-600">
                  {t("reservationExpiredPageSubtitle")}
                </p>
              </div>
              {expiredSnapshot ? (
                <div className="mx-auto mt-10 max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                  <div className="relative h-48 w-full overflow-hidden bg-slate-200">
                    {expiredSnapshot.imageUrl && String(expiredSnapshot.imageUrl).trim() ? (
                      <>
                        <img
                          src={expiredSnapshot.imageUrl}
                          alt=""
                          className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl opacity-50"
                          aria-hidden
                        />
                        <div className="relative flex h-full items-center justify-center p-6">
                          <img
                            src={expiredSnapshot.imageUrl}
                            alt=""
                            className="max-h-40 w-auto max-w-[220px] rounded-lg object-cover shadow-md"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="flex h-full items-center justify-center bg-slate-100">
                        <Ticket className="h-16 w-16 text-slate-300" aria-hidden />
                      </div>
                    )}
                  </div>
                  <div className="p-6 text-left">
                    <h3 className="text-xl font-bold text-slate-900">{expiredSnapshot.eventTitle}</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      {expiredSnapshot.venue}, {expiredSnapshot.location}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {formatCartEventWhen(locale, expiredSnapshot.eventDate, expiredSnapshot.eventTime)}
                    </p>
                    <Link
                      href={`/etkinlik/${expiredSnapshot.eventId}`}
                      onClick={clearExpiredSession}
                      className="mt-6 flex w-full items-center justify-center rounded-xl bg-primary-600 px-4 py-3.5 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-700"
                    >
                      {t("checkAvailability")}
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="mx-auto mt-10 max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-md">
                  <p className="text-sm leading-relaxed whitespace-pre-line text-slate-700">
                    {t("reservationExpiredNotice")}
                  </p>
                  <Link
                    href="/"
                    onClick={clearExpiredSession}
                    className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white hover:bg-primary-700"
                  >
                    {t("continueShopping")}
                  </Link>
                </div>
              )}
              <div className="mt-14 flex justify-center">
                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-800"
                >
                  <ArrowUp className="h-4 w-4 shrink-0" aria-hidden />
                  {t("scrollToTop")}
                </button>
              </div>
            </div>
          ) : (
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
          )
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_minmax(280px,360px)] lg:items-start">
            <div className="min-w-0 space-y-6">
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
                        {formatEventDateDMY(item.eventDate)} • {item.eventTime}
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
                    {item.seatIds && item.seatIds.length > 0 ? (
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-slate-700">
                          {t("seatsInCart", { count: item.seatIds.length })}
                        </p>
                        <ul className="mt-1 list-none space-y-0.5 pl-0 text-xs text-slate-600">
                          {item.seatIds.map((seatId, idx) => {
                            const line =
                              item.seatCaptions?.[idx]?.trim() ||
                              t("seatLineFallback", { n: idx + 1 });
                            return (
                              <li
                                key={`${item.ticketId}-seat-${seatId}`}
                                className="truncate"
                                title={line}
                              >
                                {line}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      {item.seatIds && item.seatIds.length > 0 ? (
                        <span className="text-sm font-semibold text-slate-700">
                          {item.seatIds.length} {item.seatIds.length === 1 ? "koltuk" : "koltuk"}
                        </span>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>
                    <p className="text-lg font-bold text-primary-700">
                      {formatPrice(
                        item.price *
                          (item.seatIds && item.seatIds.length > 0 ? item.seatIds.length : item.quantity),
                        item.currency as import("@/types/database").EventCurrency | undefined
                      )}
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
                  <h2 className="mb-2 text-lg font-bold text-slate-900">{t("deliveryMethod")}</h2>
                  <p className="mb-4 text-sm text-slate-600">{t("deliveryOptionsIntro")}</p>
                  <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 overflow-hidden">
                    {(
                      [
                        {
                          id: "e_ticket" as const,
                          icon: Mail,
                          title: t("eTicket"),
                          desc: t("eTicketDesc"),
                          fee: 0,
                        },
                        {
                          id: "standard" as const,
                          icon: Truck,
                          title: t("shippingStandard"),
                          desc: t("shippingStandardDesc"),
                          fee: shippingFeeForPhysicalDelivery("standard"),
                        },
                        {
                          id: "express" as const,
                          icon: Zap,
                          title: t("shippingExpress"),
                          desc: t("shippingExpressDesc"),
                          fee: shippingFeeForPhysicalDelivery("express"),
                        },
                      ] as const
                    ).map((opt) => {
                      const Icon = opt.icon;
                      const selected = deliveryChoice === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setDeliveryChoice(opt.id);
                            setStep2AddressError(null);
                          }}
                          className={`flex w-full items-start gap-3 p-4 text-left transition-colors ${
                            selected ? "bg-blue-50" : "bg-white hover:bg-slate-50"
                          }`}
                        >
                          <div
                            className={`mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
                              selected ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-900">{opt.title}</p>
                            <p className="mt-0.5 text-sm text-slate-600">{opt.desc}</p>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            {opt.fee > 0 ? (
                              <span className="text-sm font-bold text-slate-900">
                                +{formatPrice(opt.fee, checkoutCurrency)}
                              </span>
                            ) : (
                              <span className="text-sm font-semibold text-emerald-700">{t("shippingIncluded")}</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {deliveryChoice !== "e_ticket" ? (
                    <div className="mt-6 space-y-3">
                      <p className="text-sm font-medium text-slate-800">{t("shippingAddressTitle")}</p>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className="mb-2 block text-sm font-medium text-slate-600">
                            {t("addressRequired")}
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
                          <label className="mb-2 block text-sm font-medium text-slate-600">{t("plz")}</label>
                          <input
                            type="text"
                            value={buyerPlz}
                            onChange={(e) => setBuyerPlz(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                            placeholder={t("plz")}
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-600">{t("city")}</label>
                          <input
                            type="text"
                            value={buyerCity}
                            onChange={(e) => setBuyerCity(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                            placeholder={t("city")}
                          />
                        </div>
                      </div>
                      {step2AddressError ? (
                        <p className="text-sm text-red-600">{step2AddressError}</p>
                      ) : null}
                    </div>
                  ) : null}
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
                    onClick={() => {
                      if (deliveryChoice !== "e_ticket") {
                        if (!buyerAddress.trim() || !buyerPlz.trim() || !buyerCity.trim()) {
                          setStep2AddressError(t("addressRequiredShipping"));
                          return;
                        }
                      }
                      setStep2AddressError(null);
                      setCurrentStep(3);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg !bg-blue-600 px-6 py-3 font-semibold text-white hover:!bg-blue-700"
                  >
                    {t("stepContinue")}
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}

            {/* Adım 3: Ödeme bilgileri + Müşteri bilgileri */}
            {currentStep === 3 && (
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
                <p className="mt-3 text-xs text-slate-500">
                  {deliveryChoice !== "e_ticket" ? t("addressHintPhysical") : t("addressHint")}
                </p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-slate-600">
                      {deliveryChoice !== "e_ticket" ? t("addressRequired") : t("addressOptional")}
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
            )}
            </div>

            {/* Sağ: Bestellübersicht — tüm adımlar */}
            <aside className="lg:sticky lg:top-24">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-900">{t("orderOverview")}</h2>
                <div className="space-y-4 border-b border-slate-200 pb-4">
                  {items.map((item) => (
                    <div key={item.ticketId} className="text-sm">
                      <div className="flex justify-between gap-3 font-semibold text-slate-900">
                        <span>
                          {item.quantity} × {item.ticketName}
                        </span>
                        <span className="shrink-0">
                          {formatPrice(
                            item.price * item.quantity,
                            item.currency as import("@/types/database").EventCurrency | undefined
                          )}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.venue}, {item.location}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatCartEventWhen(locale, item.eventDate, item.eventTime)}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  <div className="flex justify-between">
                    <span>{t("subtotal")}</span>
                    <span>{formatPrice(totalPrice, checkoutCurrency)}</span>
                  </div>
                  {processingFeesTotal > 0 && (
                    <div className="flex justify-between">
                      <span>{t("fees")}</span>
                      <span>{formatPrice(processingFeesTotal, checkoutCurrency)}</span>
                    </div>
                  )}
                  {currentStep >= 2 && shippingFeeOnce > 0 && (
                    <div className="flex justify-between">
                      <span>{t("shippingFeeLabel")}</span>
                      <span>{formatPrice(shippingFeeOnce, checkoutCurrency)}</span>
                    </div>
                  )}
                </div>
                <div className="mt-4 flex justify-between text-lg font-bold text-slate-900">
                  <span>{t("total")}</span>
                  <span className="text-primary-700">
                    {formatPrice(displayGrandTotal, checkoutCurrency)}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  {currentStep === 1
                    ? t("summaryFooterStep1")
                    : deliveryChoice !== "e_ticket" && shippingFeeOnce > 0
                      ? t("summaryFooterWithShipping")
                      : t("summaryFooterDigital")}
                </p>

                {currentStep === 3 && (
                  <>
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
                  </>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
