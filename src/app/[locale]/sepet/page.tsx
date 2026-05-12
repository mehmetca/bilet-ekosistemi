"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import NextLink from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useCart } from "@/context/CartContext";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { supabase } from "@/lib/supabase-client";
import Header from "@/components/Header";
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
import { stripePromise } from "@/lib/stripe-client";

const EmbeddedCheckoutProvider = dynamic(
  () => import("@stripe/react-stripe-js").then((m) => m.EmbeddedCheckoutProvider),
  { ssr: false }
);
const EmbeddedCheckout = dynamic(
  () => import("@stripe/react-stripe-js").then((m) => m.EmbeddedCheckout),
  { ssr: false }
);

const SafeHeader = Header ?? (() => null);
const SafeNextLink = (NextLink ??
  ((props: { href?: string; className?: string; onClick?: () => void; children?: React.ReactNode }) => (
    <a href={props.href || "#"} className={props.className} onClick={props.onClick}>
      {props.children}
    </a>
  ))) as typeof NextLink;
const SafeEmbeddedCheckoutProvider = (EmbeddedCheckoutProvider ??
  ((props: { children?: React.ReactNode }) => <>{props.children}</>)) as typeof EmbeddedCheckoutProvider;
const SafeEmbeddedCheckout = (EmbeddedCheckout ?? (() => null)) as typeof EmbeddedCheckout;
const SafeTicketPrint = (TicketPrint ?? (() => null)) as typeof TicketPrint;

const PENDING_STRIPE_CHECKOUT_KEY = "pendingStripeCheckoutData";
const CHECKOUT_SUCCESS_SNAPSHOT_KEY = "checkoutSuccessSnapshot";

type PendingStripeCheckoutData = {
  buyerName: string;
  buyerEmail: string;
  buyerAddress: string;
  buyerPlz: string;
  buyerCity: string;
  deliveryChoice: "e_ticket" | "standard" | "express";
  seatHoldSessionId: string | null;
  createdAt: number;
};

export default function CheckoutPage() {
  const t = useTranslations("checkout");
  const tEvent = useTranslations("eventDetail");
  const locale = useLocale() as "tr" | "de" | "en";
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const processedStripeSessionsRef = useRef<Set<string>>(new Set());
  const finalizeInFlightStripeSessionsRef = useRef<Map<string, Promise<boolean>>>(new Map());
  const finalizedStripeSessionsRef = useRef<Set<string>>(new Set());
  const isPollingStripeRef = useRef(false);
  const [checkoutClientSecret, setCheckoutClientSecret] = useState<string | null>(null);
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);

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
  const [showDeliveryOptions, setShowDeliveryOptions] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [hasSuccessfulCheckout, setHasSuccessfulCheckout] = useState(false);
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

  useEffect(() => {
    if (items.length > 0 || results.length > 0 || hasSuccessfulCheckout) return;
    try {
      const raw = sessionStorage.getItem(CHECKOUT_SUCCESS_SNAPSHOT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        results?: unknown;
        completedItems?: unknown;
      };
      if (!Array.isArray(parsed?.results) || !Array.isArray(parsed?.completedItems)) return;
      const restoredResults = parsed.results as typeof results;
      if (restoredResults.length === 0) return;
      setResults(restoredResults);
      setCompletedItems(parsed.completedItems as typeof items);
      setHasSuccessfulCheckout(restoredResults.every((r) => r.success));
    } catch {
      /* ignore */
    }
  }, [hasSuccessfulCheckout, items.length, results.length]);

  useEffect(() => {
    if (!hasSuccessfulCheckout || results.length === 0) return;
    try {
      sessionStorage.setItem(
        CHECKOUT_SUCCESS_SNAPSHOT_KEY,
        JSON.stringify({
          results,
          completedItems,
        })
      );
    } catch {
      /* ignore */
    }
  }, [completedItems, hasSuccessfulCheckout, results]);

  useEffect(() => {
    if (items.length === 0) return;
    try {
      sessionStorage.removeItem(CHECKOUT_SUCCESS_SNAPSHOT_KEY);
    } catch {
      /* ignore */
    }
  }, [items.length]);

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
  const displayGrandTotal = grandTotal;

  const runFinalizePaidOrder = useCallback(async (
    pendingData?: PendingStripeCheckoutData | null,
    stripeSessionId?: string | null
  ) => {
    const finalEmail = (
      pendingData?.buyerEmail?.trim() ||
      buyerEmail.trim() ||
      user?.email ||
      ""
    ).trim();
    const finalName =
      pendingData?.buyerName?.trim() ||
      buyerName.trim() ||
      (user?.email ? user.email.split("@")[0] : "") ||
      "Müşteri";
    const finalAddress = pendingData?.buyerAddress?.trim() || buyerAddress.trim();
    const finalPlz = pendingData?.buyerPlz?.trim() || buyerPlz.trim();
    const finalCity = pendingData?.buyerCity?.trim() || buyerCity.trim();
    const finalDeliveryChoice = pendingData?.deliveryChoice || deliveryChoice;
    const finalPhysicalDelivery: CheckoutPhysicalDelivery =
      finalDeliveryChoice === "e_ticket" ? "none" : finalDeliveryChoice;
    const finalSeatHoldSessionId = pendingData?.seatHoldSessionId ?? seatHoldSessionId;
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
        if (stripeSessionId) formData.append("stripe_session_id", stripeSessionId);
        if (user?.id) formData.append("client_user_id", user.id);
        if (finalAddress) formData.append("buyer_address", finalAddress);
        if (finalPlz) formData.append("buyer_plz", finalPlz);
        if (finalCity) formData.append("buyer_city", finalCity);
        const shouldApplyShippingForThisItem =
          !shippingApplied && finalPhysicalDelivery !== "none";
        formData.append(
          "physical_delivery",
          shouldApplyShippingForThisItem ? finalPhysicalDelivery : "none"
        );
        if (seatIdsAligned.length > 0) {
          formData.append("seat_ids", JSON.stringify(seatIdsAligned));
          if (finalSeatHoldSessionId) {
            formData.append("seat_hold_session_id", finalSeatHoldSessionId);
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
        setHasSuccessfulCheckout(true);
        setCompletedItems([...items]);
        clearCart();
        try {
          sessionStorage.removeItem(PENDING_STRIPE_CHECKOUT_KEY);
        } catch {
          /* ignore */
        }
      } else {
        setHasSuccessfulCheckout(false);
        const firstFailed = orderResults.find((r) => !r.success);
        if (firstFailed?.message) setError(firstFailed.message);
      }
      return allSuccess;
    } catch {
      setError(tEvent("purchaseError"));
      return false;
    } finally {
      setIsPending(false);
    }
  }, [
    buyerAddress,
    buyerCity,
    buyerEmail,
    buyerName,
    buyerPlz,
    clearCart,
    deliveryChoice,
    items,
    seatHoldSessionId,
    tEvent,
    user,
    authAccessToken,
  ]);

  const finalizePaidOrder = useCallback(
    async (pendingData?: PendingStripeCheckoutData | null, stripeSessionId?: string | null) => {
      const normalizedSessionId = stripeSessionId?.trim();
      if (normalizedSessionId && finalizedStripeSessionsRef.current.has(normalizedSessionId)) {
        return true;
      }

      const existingInFlight = normalizedSessionId
        ? finalizeInFlightStripeSessionsRef.current.get(normalizedSessionId)
        : undefined;
      if (existingInFlight) return existingInFlight;

      const finalizeTask = runFinalizePaidOrder(pendingData, stripeSessionId);
      if (normalizedSessionId) {
        finalizeInFlightStripeSessionsRef.current.set(normalizedSessionId, finalizeTask);
      }
      try {
        const ok = await finalizeTask;
        if (normalizedSessionId && ok) {
          finalizedStripeSessionsRef.current.add(normalizedSessionId);
        }
        return ok;
      } finally {
        if (normalizedSessionId) {
          finalizeInFlightStripeSessionsRef.current.delete(normalizedSessionId);
        }
      }
    },
    [runFinalizePaidOrder]
  );

  async function handleCompleteOrder(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) return;
    setHasSuccessfulCheckout(false);
    try {
      sessionStorage.removeItem(CHECKOUT_SUCCESS_SNAPSHOT_KEY);
    } catch {
      /* ignore */
    }

    const finalEmail = (buyerEmail.trim() || user?.email || "").trim();
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
    if (shippingFeeOnce > 0) {
      if (!buyerAddress.trim() || !buyerPlz.trim() || !buyerCity.trim()) {
        setError(t("addressRequiredShipping"));
        return;
      }
    }

    setError(null);
    setIsPending(true);
    try {
      try {
        const pendingData: PendingStripeCheckoutData = {
          buyerName: buyerName.trim(),
          buyerEmail: finalEmail,
          buyerAddress: buyerAddress.trim(),
          buyerPlz: buyerPlz.trim(),
          buyerCity: buyerCity.trim(),
          deliveryChoice,
          seatHoldSessionId,
          createdAt: Date.now(),
        };
        sessionStorage.setItem(PENDING_STRIPE_CHECKOUT_KEY, JSON.stringify(pendingData));
      } catch {
        /* ignore */
      }

      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: grandTotal,
          currency: (checkoutCurrency || "EUR").toLowerCase(),
          buyerEmail: finalEmail,
          locale,
        }),
      });
      const data = (await response.json()) as {
        success?: boolean;
        sessionId?: string;
        clientSecret?: string | null;
        message?: string;
      };
      if (!response.ok || !data.success || !data.clientSecret || !data.sessionId) {
        setError(data.message || "Stripe ödeme oturumu başlatılamadı.");
        return;
      }

      setCheckoutClientSecret(data.clientSecret);
      setCheckoutSessionId(data.sessionId);
      setCurrentStep(2);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Stripe ödeme akışı başlatılırken bir hata oluştu.");
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

  useEffect(() => {
    const stripeSuccess = searchParams.get("stripe_success");
    const sessionId = (searchParams.get("session_id") || "").trim();
    if (stripeSuccess === "1" && currentStep !== 2) {
      setCurrentStep(2);
    }
    if (stripeSuccess !== "1" || !sessionId) return;
    if (processedStripeSessionsRef.current.has(sessionId)) return;
    if (results.length > 0 || isPending || items.length === 0) return;

    processedStripeSessionsRef.current.add(sessionId);
    void (async () => {
      try {
        setIsPending(true);
        let pendingData: PendingStripeCheckoutData | null = null;
        try {
          const raw = sessionStorage.getItem(PENDING_STRIPE_CHECKOUT_KEY);
          if (raw) pendingData = JSON.parse(raw) as PendingStripeCheckoutData;
        } catch {
          pendingData = null;
        }
        const verifyRes = await fetch("/api/stripe/verify-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const verifyData = (await verifyRes.json()) as { success?: boolean; paid?: boolean; message?: string };
        if (!verifyRes.ok || !verifyData.success || !verifyData.paid) {
          setError(verifyData.message || "Stripe ödemesi doğrulanamadı.");
          router.replace(`/${locale}/sepet`);
          return;
        }
        const success = await finalizePaidOrder(pendingData, sessionId);
        router.replace(`/${locale}/sepet`);
        if (!success) {
          try {
            sessionStorage.removeItem(PENDING_STRIPE_CHECKOUT_KEY);
          } catch {
            /* ignore */
          }
        }
      } catch {
        setError("Stripe ödemesi doğrulanırken bir hata oluştu.");
        router.replace(`/${locale}/sepet`);
      } finally {
        setIsPending(false);
      }
    })();
  }, [searchParams, results.length, isPending, items.length, finalizePaidOrder, router, locale, currentStep]);

  const handleEmbeddedCheckoutComplete = useCallback(async () => {
    if (!checkoutSessionId || isPending) return;
    try {
      setIsPending(true);
      let pendingData: PendingStripeCheckoutData | null = null;
      try {
        const raw = sessionStorage.getItem(PENDING_STRIPE_CHECKOUT_KEY);
        if (raw) pendingData = JSON.parse(raw) as PendingStripeCheckoutData;
      } catch {
        pendingData = null;
      }

      const verifyRes = await fetch("/api/stripe/verify-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: checkoutSessionId }),
      });
      const verifyData = (await verifyRes.json()) as { success?: boolean; paid?: boolean; message?: string };
      if (!verifyRes.ok || !verifyData.success || !verifyData.paid) {
        setError(verifyData.message || "Stripe ödemesi doğrulanamadı.");
        return;
      }

      await finalizePaidOrder(pendingData, checkoutSessionId);
    } catch {
      setError("Ödeme sonrası sipariş oluşturulurken bir hata oluştu.");
    } finally {
      setIsPending(false);
    }
  }, [checkoutSessionId, finalizePaidOrder, isPending]);

  // Bazı Stripe sürümlerinde embedded teşekkür ekranı gösterilip onComplete her zaman tetiklenmeyebiliyor.
  // Bu yüzden ödeme adımında session durumunu kısa aralıkla doğrulayıp başarılıysa siparişi finalize et.
  useEffect(() => {
    if (!checkoutSessionId || currentStep !== 2 || hasSuccessfulCheckout || results.length > 0) return;
    let cancelled = false;

    const verifyAndFinalizeIfPaid = async () => {
      if (cancelled || isPollingStripeRef.current || isPending) return;
      isPollingStripeRef.current = true;
      try {
        const verifyRes = await fetch("/api/stripe/verify-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: checkoutSessionId }),
        });
        const verifyData = (await verifyRes.json()) as { success?: boolean; paid?: boolean };
        if (!verifyRes.ok || !verifyData.success || !verifyData.paid) return;
        await handleEmbeddedCheckoutComplete();
      } catch {
        // geçici ağ hatalarında sonraki tur yeniden dener
      } finally {
        isPollingStripeRef.current = false;
      }
    };

    void verifyAndFinalizeIfPaid();
    const intervalId = window.setInterval(() => {
      void verifyAndFinalizeIfPaid();
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    checkoutSessionId,
    currentStep,
    handleEmbeddedCheckoutComplete,
    hasSuccessfulCheckout,
    isPending,
    results.length,
  ]);

  const isStripeReturning = searchParams.get("stripe_success") === "1";
  const allSuccess = hasSuccessfulCheckout || (results.length > 0 && results.every((r) => r.success));
  const shouldShowEmptyCart =
    items.length === 0 &&
    results.length === 0 &&
    !allSuccess &&
    !isPending &&
    !isStripeReturning;

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
  const successPageTitle =
    locale === "de"
      ? "TICKETS"
      : locale === "en"
        ? "TICKETS"
        : "BILETLER";
  const emailSentSuccessText =
    locale === "de"
      ? "Deine Tickets wurden an deine E-Mail-Adresse gesendet."
      : locale === "en"
        ? "Your tickets were sent to your e-mail address."
        : "Biletlerin e-posta adresine gonderilmistir.";

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
        <SafeHeader />

      <div className="site-container py-8">
        {/* Progress steps – ödeme adımları */}
        {!showExpiredFullPage && !allSuccess ? (
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
              {t("stepPayment")}
            </span>
          </button>
        </div>
        ) : null}

        {!showExpiredFullPage && !allSuccess ? (
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

        {!showExpiredFullPage && !allSuccess && items.length > 0 && reservationExpiresAt && reservationSecLeft > 0 ? (
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
            <SafeNextLink
              href={`/${locale}/giris?redirect=/${locale}/sepet`}
              className="inline-flex items-center gap-2 rounded-lg !bg-blue-600 px-6 py-3 font-semibold text-white hover:!bg-blue-700"
            >
              {t("loginOrSignup")}
            </SafeNextLink>
          </div>
        ) : allSuccess ? (
          <div className="space-y-6">
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-green-800">
              <h1 className="text-center text-3xl font-bold text-slate-900 md:text-4xl">
                {locale === "tr" ? "Biletler" : successPageTitle}
              </h1>
              {results.every((r) => r.success && r.emailSent !== false) ? (
                <p className="mt-1 text-sm">{emailSentSuccessText}</p>
              ) : null}
            </div>
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
                  <SafeTicketPrint
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
            <SafeNextLink
              href={`/${locale}`}
              className="inline-flex items-center gap-2 rounded-lg !bg-blue-600 px-6 py-3 font-semibold text-white hover:!bg-blue-700"
            >
              {t("continueShopping")}
            </SafeNextLink>
          </div>
        ) : shouldShowEmptyCart ? (
          showExpiredFullPage ? (
            <div className="pb-10">
              <SafeNextLink
                href={`/${locale}`}
                onClick={clearExpiredSession}
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 hover:text-primary-800"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                {t("backToShop")}
              </SafeNextLink>
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
                    <SafeNextLink
                      href={`/${locale}/etkinlik/${expiredSnapshot.eventId}`}
                      onClick={clearExpiredSession}
                      className="mt-6 flex w-full items-center justify-center rounded-xl bg-primary-600 px-4 py-3.5 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-700"
                    >
                      {t("checkAvailability")}
                    </SafeNextLink>
                  </div>
                </div>
              ) : (
                <div className="mx-auto mt-10 max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-md">
                  <p className="text-sm leading-relaxed whitespace-pre-line text-slate-700">
                    {t("reservationExpiredNotice")}
                  </p>
                  <SafeNextLink
                    href={`/${locale}`}
                    onClick={clearExpiredSession}
                    className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white hover:bg-primary-700"
                  >
                    {t("continueShopping")}
                  </SafeNextLink>
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
            <SafeNextLink
              href={`/${locale}`}
              className="inline-flex items-center gap-2 rounded-lg !bg-blue-600 px-6 py-3 font-semibold text-white hover:!bg-blue-700"
            >
              {t("continueShopping")}
            </SafeNextLink>
          </div>
          )
        ) : (
          <div
            className={`grid gap-8 lg:items-start ${
              currentStep === 2
                ? "lg:grid-cols-[minmax(0,2fr)_minmax(280px,340px)]"
                : "lg:grid-cols-[1fr_minmax(280px,360px)]"
            }`}
          >
            <div className="min-w-0 space-y-6">
            {/* Adım 1: Sepet + Teslimat + Müşteri */}
            {currentStep === 1 && (
              <div className="space-y-4">
                {items.map((item) => (
                  <div
                    key={item.ticketId}
                    className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    {item.imageUrl && (
                      <div className="relative h-20 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
                        <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
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
                              const line = item.seatCaptions?.[idx]?.trim() || t("seatLineFallback", { n: idx + 1 });
                              return (
                                <li key={`${item.ticketId}-seat-${seatId}`} className="truncate" title={line}>
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
                          <span className="text-sm font-semibold text-slate-700">{item.seatIds.length} koltuk</span>
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
                          item.price * (item.seatIds && item.seatIds.length > 0 ? item.seatIds.length : item.quantity),
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

                <div className="rounded-xl border border-slate-200 bg-white p-6">
                  <h2 className="mb-2 text-lg font-bold text-slate-900">{t("deliveryMethod")}</h2>
                  <p className="mb-4 text-sm text-slate-600">{t("deliveryOptionsIntro")}</p>
                  <button
                    type="button"
                    onClick={() => setShowDeliveryOptions((v) => !v)}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {t("selectShipping")}
                  </button>
                  {showDeliveryOptions ? (
                    <div className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200 overflow-hidden">
                      {(
                        [
                          { id: "e_ticket" as const, icon: Mail, title: t("eTicket"), desc: t("eTicketDesc"), fee: 0 },
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
                                <span className="text-sm font-bold text-slate-900">+{formatPrice(opt.fee, checkoutCurrency)}</span>
                              ) : (
                                <span className="text-sm font-semibold text-emerald-700">{t("shippingIncluded")}</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>

                {showDeliveryOptions ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-6">
                    <h2 className="mb-4 text-lg font-bold text-slate-900">{t("customerInfo")}</h2>
                    {user ? (
                      <div className="mb-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
                        <p><span className="font-medium">{t("fullName")}:</span> {buyerName || user.email?.split("@")[0] || "—"}</p>
                        <p className="mt-1"><span className="font-medium">{t("email")}:</span> {buyerEmail || user.email || "—"}</p>
                      </div>
                    ) : null}
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
                    {user && !buyerAddress && !buyerPlz && !buyerCity ? (
                      <p className="mt-2 text-xs text-primary-600">
                        <SafeNextLink href={`/${locale}/bilgilerim`} className="underline hover:no-underline">
                          {t("fillFromProfile")}
                        </SafeNextLink>
                      </p>
                    ) : null}
                    {step2AddressError ? <p className="mt-2 text-sm text-red-600">{step2AddressError}</p> : null}
                  </div>
                ) : null}
              </div>
            )}

            {/* Adım 2: Ödeme */}
            {currentStep === 2 && (
              <div className="space-y-4">
              {/* Stripe ödeme - üstte */}
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <h2 className="mb-4 text-lg font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-slate-600" />
                  {t("paymentDetails")}
                </h2>
                <p className="mb-4 flex items-center gap-2 text-sm text-slate-600">
                  <Lock className="h-4 w-4" />
                  {t("securePayment")}
                </p>
                {checkoutClientSecret && stripePromise ? (
                  <div className="mt-4 px-0 md:px-1">
                    <div className="w-full rounded-lg border border-slate-200 bg-white p-2 md:p-3 lg:p-4">
                      <SafeEmbeddedCheckoutProvider
                        stripe={stripePromise}
                        options={{
                          clientSecret: checkoutClientSecret,
                          onComplete: () => {
                            void handleEmbeddedCheckoutComplete();
                          },
                        }}
                      >
                        <SafeEmbeddedCheckout />
                      </SafeEmbeddedCheckoutProvider>
                    </div>
                  </div>
                ) : null}
                {(isPending || isStripeReturning) ? (
                  <p className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                    İşleminiz devam ediyor. Lütfen bekleyiniz, sayfayı kapatmayın ve yenilemeyin.
                  </p>
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
                  {shippingFeeOnce > 0 && (
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
                  {deliveryChoice !== "e_ticket" && shippingFeeOnce > 0
                      ? t("summaryFooterWithShipping")
                      : t("summaryFooterDigital")}
                </p>

                {currentStep === 1 && (
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
                        void handleCompleteOrder(e as unknown as React.FormEvent);
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
