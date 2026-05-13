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
  addItem: (item: CartItemAddPayload) => void;
  /** Birden fazla satırı tek `setItems` güncellemesinde işler (çift tik / çift yüklemede adet yanlış ikiye çıkmasını önler). */
  addItemsBatch: (items: CartItemAddPayload[]) => void;
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

/** Sepette satır birleştirme: yalnızca aynı etkinlik + aynı bilet kaydı. `ticketName` ile eşleme yapılmaz (farklı fiyat kategorileri aynı ada düşünce tek satırda üst üste binip adet tavanında kalıyordu). */
function isSameCatalogLine(
  a: Pick<CartItem, "eventId" | "ticketId">,
  b: Pick<CartItem, "eventId" | "ticketId">
): boolean {
  return a.eventId === b.eventId && a.ticketId === b.ticketId;
}

export type CartItemAddPayload = Omit<CartItem, "quantity"> & { quantity?: number };

function sumQtyExcludingSKU(prev: CartItem[], rawItem: CartItemAddPayload): number {
  return prev.reduce((acc, i) => acc + (isSameCatalogLine(i, rawItem) ? 0 : i.quantity), 0);
}

/**
 * Tek satır güncellemesi. `quantity` için üst sınır:
 * hem satır bazlı `max_ticket_quantity` hem de **tüm sepetteki biletlere** uygulanan toplam tavan (aynı değişken).
 */
function upsertCartItem(
  prev: CartItem[],
  rawItem: CartItemAddPayload,
  maxTicketQuantity: number,
  now: number
): CartItem[] {
  const cap = Math.max(1, maxTicketQuantity);
  const incomingQty = Math.max(1, Math.min(cap, rawItem.quantity ?? 1));
  const seatIds = rawItem.seatIds && rawItem.seatIds.length > 0 ? rawItem.seatIds : undefined;
  const seatCaptions =
    rawItem.seatCaptions && rawItem.seatCaptions.length > 0 ? rawItem.seatCaptions : undefined;

  const existing = prev.find((i) => isSameCatalogLine(i, rawItem));
  /** Aynı bilet/satır SKU’su (event+ticketId) dışındaki kalemlerin quantity toplamı */
  const qtyOtherLines = sumQtyExcludingSKU(prev, rawItem);
  /** Bu satırda nihai quantity en fazla ne olabilir (tüm sepet ≤ cap)? */
  const maxQtyThisLine = Math.max(0, cap - qtyOtherLines);

  if (existing) {
    const prevIds = existing.seatIds || [];

    if (seatIds) {
      const mergedOrderUnique: string[] = [...prevIds];
      for (const id of seatIds) {
        if (!mergedOrderUnique.includes(id)) mergedOrderUnique.push(id);
      }
      const clippedIds = mergedOrderUnique.slice(0, Math.min(mergedOrderUnique.length, maxQtyThisLine || 0));
      const clippedCaptions = captionsAlignedWithSeatIds(
        clippedIds,
        prevIds,
        existing.seatCaptions,
        seatCaptions,
        seatIds
      );
      const newQty = clippedIds.length;
      if (newQty <= 0) return prev.filter((i) => !isSameCatalogLine(i, rawItem));
      return prev.map((i) =>
        isSameCatalogLine(i, rawItem)
          ? {
              ...i,
              quantity: newQty,
              seatIds: clippedIds,
              seatCaptions: clippedCaptions,
              available: Math.max(i.available, rawItem.available),
              eventCheckoutFee: rawItem.eventCheckoutFee ?? i.eventCheckoutFee,
              addedAt: now,
            }
          : i
      );
    }

    /** Mevcut koltuk satırı — yeni koltuk eklenmemişse (ör. toplam tavan düştü) yalnızca kırpma */
    if (prevIds.length > 0) {
      const clippedIds = [...prevIds].slice(0, Math.min(prevIds.length, maxQtyThisLine || 0));
      const clippedCaptions = captionsAlignedWithSeatIds(
        clippedIds,
        prevIds,
        existing.seatCaptions,
        undefined,
        []
      );
      const newQty = clippedIds.length;
      if (newQty <= 0) return prev.filter((i) => !isSameCatalogLine(i, rawItem));
      return prev.map((i) =>
        isSameCatalogLine(i, rawItem)
          ? {
              ...i,
              quantity: newQty,
              seatIds: clippedIds,
              seatCaptions: clippedCaptions,
              available: Math.max(i.available, rawItem.available),
              eventCheckoutFee: rawItem.eventCheckoutFee ?? i.eventCheckoutFee,
              addedAt: now,
            }
          : i
      );
    }

    /** Koltuksuz satırda adet birleştirme */
    const mergedProposalQty = Math.min(cap, existing.quantity + incomingQty);
    const finalQty = Math.min(mergedProposalQty, maxQtyThisLine);
    if (finalQty <= 0) return prev.filter((i) => !isSameCatalogLine(i, rawItem));
    return prev.map((i) =>
      isSameCatalogLine(i, rawItem)
        ? {
            ...i,
            quantity: finalQty,
            seatIds: existing.seatIds,
            seatCaptions: existing.seatCaptions,
            available: Math.max(i.available, rawItem.available),
            eventCheckoutFee: rawItem.eventCheckoutFee ?? i.eventCheckoutFee,
            addedAt: now,
          }
        : i
    );
  }

  /** Yeni kalem */
  if (maxQtyThisLine <= 0) return prev;

  const cappedSeatIds =
    seatIds && seatIds.length > 0
      ? [...seatIds].slice(0, Math.min(cap, seatIds.length, maxQtyThisLine))
      : undefined;
  const qtyCatalogNew =
    cappedSeatIds && cappedSeatIds.length > 0
      ? 0
      : Math.min(cap, incomingQty, maxQtyThisLine);
  const captionsNew =
    cappedSeatIds && cappedSeatIds.length > 0
      ? captionsAlignedWithSeatIds(cappedSeatIds, [], undefined, seatCaptions, cappedSeatIds)
      : undefined;

  const outQty =
    cappedSeatIds && cappedSeatIds.length > 0 ? cappedSeatIds.length : qtyCatalogNew;

  if (outQty <= 0) return prev;

  return [
    ...prev,
    {
      ...(rawItem as CartItem),
      quantity: outQty,
      seatIds: cappedSeatIds && cappedSeatIds.length > 0 ? cappedSeatIds : undefined,
      seatCaptions:
        cappedSeatIds && cappedSeatIds.length > 0 ? captionsNew : undefined,
      addedAt: now,
    },
  ];
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

  const addItem = useCallback((item: CartItemAddPayload) => {
    const now = Date.now();
    bumpReservation();
    try {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(CART_EXPIRED_SNAPSHOT_KEY);
      }
    } catch {
      /* ignore */
    }
    setItems((prev) => upsertCartItem(prev, item, maxTicketQuantity, now));
  }, [maxTicketQuantity, bumpReservation]);

  const addItemsBatch = useCallback((batch: CartItemAddPayload[]) => {
    if (batch.length === 0) return;
    const now = Date.now();
    bumpReservation();
    try {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(CART_EXPIRED_SNAPSHOT_KEY);
      }
    } catch {
      /* ignore */
    }
    const capUsed = Math.max(1, maxTicketQuantity);
    setItems((prev) => batch.reduce((acc, payload) => upsertCartItem(acc, payload, capUsed, now), prev));
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

  const updateQuantity = useCallback(
    (ticketId: string, quantity: number) => {
      setItems((prev) => {
        const cap = Math.max(1, maxTicketQuantity);
        const rowIndex = prev.findIndex(
          (i) => i.ticketId === ticketId && !(i.seatIds && i.seatIds.length > 0)
        );
        if (rowIndex < 0) return prev;
        const row = prev[rowIndex]!;
        const othersSum = prev.reduce((s, x, idx) => s + (idx === rowIndex ? 0 : x.quantity), 0);
        const maxForRow = Math.max(0, cap - othersSum);
        const qty = Math.max(0, Math.min(Number(quantity), row.available, maxForRow));
        if (qty <= 0) {
          return prev.filter((_, idx) => idx !== rowIndex);
        }
        return prev.map((x, idx) => (idx === rowIndex ? { ...x, quantity: qty, addedAt: Date.now() } : x));
      });
    },
    [maxTicketQuantity]
  );

  const updateItemAvailable = useCallback(
    (ticketId: string, available: number) => {
      const safeAvailable = Math.max(0, available);
      let toRelease: CartItem[] = [];
      setItems((prev) => {
        toRelease = [];
        return prev
          .map((i) => {
            if (i.ticketId !== ticketId) return i;
            const seatIds = i.seatIds;
            if (seatIds && seatIds.length > 0) {
              const cap = Math.min(seatIds.length, safeAvailable);
              if (cap <= 0) {
                toRelease.push({ ...i, seatIds: [...seatIds], quantity: seatIds.length });
                return null;
              }
              if (cap < seatIds.length) {
                const released = seatIds.slice(cap);
                toRelease.push({
                  ...i,
                  seatIds: released,
                  quantity: released.length,
                });
                const kept = seatIds.slice(0, cap);
                const caps =
                  i.seatCaptions && i.seatCaptions.length === seatIds.length
                    ? i.seatCaptions.slice(0, cap)
                    : undefined;
                return {
                  ...i,
                  available: safeAvailable,
                  quantity: cap,
                  seatIds: kept,
                  seatCaptions: caps,
                };
              }
              return { ...i, available: safeAvailable, quantity: seatIds.length };
            }
            const newQty = Math.min(i.quantity, safeAvailable);
            if (newQty <= 0) return null;
            return { ...i, available: safeAvailable, quantity: newQty };
          })
          .filter((i): i is CartItem => i !== null);
      });
      if (toRelease.length > 0) {
        void releaseSeatHoldsForItems(toRelease);
      }
    },
    [releaseSeatHoldsForItems]
  );

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        reservationExpiresAt,
        addItem,
        addItemsBatch,
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
