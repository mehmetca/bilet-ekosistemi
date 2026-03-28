"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import {
  CART_RESERVATION_MS,
  CART_EXPIRY_KEY,
  CART_EXPIRED_FLAG_KEY,
  CART_EXPIRED_SNAPSHOT_KEY,
} from "@/lib/cart-reservation";

/** Yer seçerek bilet al: sepette hangi koltukların satın alındığı (bilette ve dolu gösterimi için) */
export interface CartItem {
  ticketId: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  location: string;
  imageUrl?: string;
  ticketName: string;
  price: number;
  currency?: string;
  quantity: number;
  available: number;
  /** Yer seçerek eklenen biletlerde: koltuk ID'leri (siparişte order_seats'e yazılır, bilette gösterilir) */
  seatIds?: string[];
  /** seatIds ile aynı sırada: insan okunur koltuk satırı (örn. Duisburg plaka) */
  seatCaptions?: string[];
  /** Etkinlikte tanımlıysa: bu etkinlik için sepet özetinde bir kez gösterilir / ödemede ilk satırda uygulanır */
  eventCheckoutFee?: number | null;
  /** Sepete eklendiği an (ms epoch). Süre dolunca otomatik temizlenir. */
  addedAt?: number;
}

interface CartContextValue {
  items: CartItem[];
  /** Sepet rezervasyonunun bittiği epoch ms; yoksa süre yok. */
  reservationExpiresAt: number | null;
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  removeItem: (ticketId: string) => void;
  removeSeatItem: (eventId: string, seatId: string) => void;
  updateQuantity: (ticketId: string, quantity: number) => void;
  /** Güncel stok bilgisini günceller; quantity stoktan fazlaysa stoka indirilir */
  updateItemAvailable: (ticketId: string, available: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CART_STORAGE_KEY = "bilet_ekosistemi_cart";
const SEAT_HOLD_LS_KEY = "seatHoldSessionId";

/** seatIds sırasıyla aynı uzunlukta açıklama (birleştirme sonrası kaybolmasın). */
function captionsAlignedWithSeatIds(
  seatIds: string[],
  prevIds: string[],
  prevCaps: string[] | undefined,
  newCaps: string[] | undefined,
  newIds: string[]
): string[] {
  const byId = new Map<string, string>();
  prevIds.forEach((id, i) => {
    if (prevCaps?.[i]) byId.set(id, prevCaps[i]!);
  });
  newIds.forEach((id, i) => {
    if (!byId.has(id) && newCaps?.[i]) byId.set(id, newCaps[i]!);
  });
  return seatIds.map((id, idx) => byId.get(id) ?? `Koltuk ${idx + 1}`);
}

const CartContext = createContext<CartContextValue | null>(null);

type LoadedCart = { items: CartItem[]; expiresAt: number | null };

function loadCart(): LoadedCart {
  if (typeof window === "undefined") return { items: [], expiresAt: null };
  const now = Date.now();
  const expRaw = localStorage.getItem(CART_EXPIRY_KEY);
  const exp = expRaw ? parseInt(expRaw, 10) : NaN;
  const expiresValid = Number.isFinite(exp) && exp > now;

  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) {
      localStorage.removeItem(CART_EXPIRY_KEY);
      return { items: [], expiresAt: null };
    }
    const parsed = JSON.parse(raw) as CartItem[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.removeItem(CART_STORAGE_KEY);
      localStorage.removeItem(CART_EXPIRY_KEY);
      return { items: [], expiresAt: null };
    }
    if (!expiresValid) {
      localStorage.removeItem(CART_STORAGE_KEY);
      localStorage.removeItem(CART_EXPIRY_KEY);
      return { items: [], expiresAt: null };
    }
    return {
      items: parsed.map((item) => ({
        ...item,
        addedAt: typeof item.addedAt === "number" ? item.addedAt : now,
      })),
      expiresAt: exp,
    };
  } catch {
    localStorage.removeItem(CART_STORAGE_KEY);
    localStorage.removeItem(CART_EXPIRY_KEY);
    return { items: [], expiresAt: null };
  }
}

function saveCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

const DEFAULT_MAX_TICKET_QUANTITY = 10;

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [reservationExpiresAt, setReservationExpiresAt] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [maxTicketQuantity, setMaxTicketQuantity] = useState(DEFAULT_MAX_TICKET_QUANTITY);
  const itemsRef = useRef<CartItem[]>([]);
  itemsRef.current = items;

  useEffect(() => {
    const { items: loaded, expiresAt } = loadCart();
    setItems(loaded);
    setReservationExpiresAt(expiresAt);
    setHydrated(true);
  }, []);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (typeof data?.maxTicketQuantity === "number") {
          setMaxTicketQuantity(Math.max(1, Math.min(100, data.maxTicketQuantity)));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (hydrated) saveCart(items);
    if (hydrated && items.length === 0) {
      setReservationExpiresAt(null);
      if (typeof window !== "undefined") localStorage.removeItem(CART_EXPIRY_KEY);
    }
  }, [items, hydrated]);

  const releaseSeatHoldsForItems = useCallback(async (targetItems: CartItem[]) => {
    if (typeof window === "undefined") return;
    const sessionId = window.localStorage.getItem(SEAT_HOLD_LS_KEY);
    if (!sessionId) return;
    const tasks: Promise<Response>[] = [];
    for (const item of targetItems) {
      const seatIds = item.seatIds || [];
      for (const seatId of seatIds) {
        tasks.push(
          fetch("/api/seat-holds", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId: item.eventId, seatId, sessionId }),
          })
        );
      }
    }
    if (tasks.length > 0) {
      await Promise.allSettled(tasks);
    }
  }, []);

  const clearCart = useCallback((opts?: { reason?: "reservation_expired" }) => {
    const snapshot = itemsRef.current;
    if (opts?.reason === "reservation_expired" && snapshot.length > 0 && typeof window !== "undefined") {
      const first = snapshot[0];
      try {
        sessionStorage.setItem(
          CART_EXPIRED_SNAPSHOT_KEY,
          JSON.stringify({
            eventId: first.eventId,
            eventTitle: first.eventTitle,
            imageUrl: first.imageUrl ?? "",
            venue: first.venue,
            location: first.location,
            eventDate: first.eventDate,
            eventTime: first.eventTime,
          })
        );
        sessionStorage.setItem(CART_EXPIRED_FLAG_KEY, "1");
      } catch {
        /* ignore */
      }
    }
    setItems([]);
    setReservationExpiresAt(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(CART_EXPIRY_KEY);
    }
    if (snapshot.length > 0) {
      void releaseSeatHoldsForItems(snapshot);
    }
  }, [releaseSeatHoldsForItems]);

  useEffect(() => {
    if (!hydrated || items.length === 0 || reservationExpiresAt == null) return;
    const tick = () => {
      if (Date.now() >= reservationExpiresAt) {
        clearCart({ reason: "reservation_expired" });
      }
    };
    const id = window.setInterval(tick, 1000);
    tick();
    return () => window.clearInterval(id);
  }, [hydrated, items.length, reservationExpiresAt, clearCart]);

  const bumpReservation = useCallback(() => {
    const next = Date.now() + CART_RESERVATION_MS;
    setReservationExpiresAt(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(CART_EXPIRY_KEY, String(next));
    }
  }, []);

  const addItem = useCallback((item: Omit<CartItem, "quantity"> & { quantity?: number }) => {
    const cap = Math.max(1, maxTicketQuantity);
    const qty = Math.max(1, Math.min(cap, item.quantity ?? 1));
    const now = Date.now();
    bumpReservation();
    try {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(CART_EXPIRED_SNAPSHOT_KEY);
      }
    } catch {
      /* ignore */
    }
    const seatIds = item.seatIds && item.seatIds.length > 0 ? item.seatIds : undefined;
    const seatCaptions =
      item.seatCaptions && item.seatCaptions.length > 0 ? item.seatCaptions : undefined;
    setItems((prev) => {
      const existing = prev.find(
        (i) => i.eventId === item.eventId && (i.ticketName || "").trim() === (item.ticketName || "").trim()
      );
      if (existing) {
        const prevIds = existing.seatIds || [];
        const mergedSeatIds = seatIds
          ? Array.from(new Set([...prevIds, ...seatIds])).slice(0, cap)
          : existing.seatIds;
        const mergedCaptions =
          mergedSeatIds && mergedSeatIds.length > 0
            ? captionsAlignedWithSeatIds(
                mergedSeatIds,
                prevIds,
                existing.seatCaptions,
                seatCaptions,
                seatIds || []
              )
            : undefined;
        const newQty = mergedSeatIds ? mergedSeatIds.length : Math.min(existing.available, cap, existing.quantity + qty);
        if (newQty <= 0) return prev.filter((i) => !(i.eventId === item.eventId && (i.ticketName || "").trim() === (item.ticketName || "").trim()));
        return prev.map((i) =>
          i.eventId === item.eventId && (i.ticketName || "").trim() === (item.ticketName || "").trim()
            ? {
                ...i,
                quantity: newQty,
                seatIds: mergedSeatIds,
                seatCaptions: mergedCaptions,
                available: Math.max(i.available, item.available),
                eventCheckoutFee: item.eventCheckoutFee ?? i.eventCheckoutFee,
                addedAt: now,
              }
            : i
        );
      }
      const cappedSeatIds = seatIds ? seatIds.slice(0, cap) : undefined;
      const captionsNew =
        cappedSeatIds && cappedSeatIds.length > 0
          ? captionsAlignedWithSeatIds(cappedSeatIds, [], undefined, seatCaptions, cappedSeatIds)
          : undefined;
      return [
        ...prev,
        {
          ...item,
          quantity: cappedSeatIds ? cappedSeatIds.length : Math.min(item.available, cap, qty),
          seatIds: cappedSeatIds,
          seatCaptions: captionsNew,
          addedAt: now,
        },
      ];
    });
  }, [maxTicketQuantity, bumpReservation]);

  const removeItem = useCallback((ticketId: string) => {
    let removed: CartItem[] = [];
    setItems((prev) => {
      removed = prev.filter((i) => i.ticketId === ticketId);
      return prev.filter((i) => i.ticketId !== ticketId);
    });
    if (removed.length > 0) {
      void releaseSeatHoldsForItems(removed);
    }
  }, [releaseSeatHoldsForItems]);

  const removeSeatItem = useCallback((eventId: string, seatId: string) => {
    setItems((prev) =>
      prev
        .map((item) => {
          if (item.eventId !== eventId || !item.seatIds?.includes(seatId)) return item;
          const oldSeatIds = item.seatIds || [];
          const oldCaptions = item.seatCaptions || [];
          const removeIdx = oldSeatIds.findIndex((id) => id === seatId);
          if (removeIdx < 0) return item;
          const nextSeatIds = oldSeatIds.filter((id) => id !== seatId);
          const nextCaptions =
            oldCaptions.length === oldSeatIds.length
              ? oldCaptions.filter((_, idx) => idx !== removeIdx)
              : undefined;
          if (nextSeatIds.length === 0) return null;
          return {
            ...item,
            seatIds: nextSeatIds,
            seatCaptions: nextCaptions,
            quantity: nextSeatIds.length,
            addedAt: Date.now(),
          };
        })
        .filter((i): i is CartItem => i !== null)
    );
    void releaseSeatHoldsForItems([
      {
        ticketId: "",
        eventId,
        eventTitle: "",
        eventDate: "",
        eventTime: "",
        venue: "",
        location: "",
        ticketName: "",
        price: 0,
        quantity: 1,
        available: 0,
        seatIds: [seatId],
      },
    ]);
  }, [releaseSeatHoldsForItems]);

  const updateQuantity = useCallback((ticketId: string, quantity: number) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.ticketId !== ticketId) return i;
        const qty = Math.max(0, Math.min(i.available, quantity));
        return qty === 0 ? i : { ...i, quantity: qty };
      }).filter((i) => i.quantity > 0)
    );
  }, []);

  const updateItemAvailable = useCallback((ticketId: string, available: number) => {
    const safeAvailable = Math.max(0, available);
    setItems((prev) =>
      prev.map((i) => {
        if (i.ticketId !== ticketId) return i;
        const newQty = Math.min(i.quantity, safeAvailable);
        if (newQty <= 0) return null;
        return { ...i, available: safeAvailable, quantity: newQty };
      }).filter((i): i is CartItem => i !== null)
    );
  }, []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        reservationExpiresAt,
        addItem,
        removeItem,
        removeSeatItem,
        updateQuantity,
        updateItemAvailable,
        clearCart,
        totalItems,
        totalPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
