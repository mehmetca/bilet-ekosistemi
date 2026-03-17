"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

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
}

interface CartContextValue {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  removeItem: (ticketId: string) => void;
  updateQuantity: (ticketId: string, quantity: number) => void;
  /** Güncel stok bilgisini günceller; quantity stoktan fazlaysa stoka indirilir */
  updateItemAvailable: (ticketId: string, available: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CART_STORAGE_KEY = "bilet_ekosistemi_cart";

const CartContext = createContext<CartContextValue | null>(null);

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
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
  const [hydrated, setHydrated] = useState(false);
  const [maxTicketQuantity, setMaxTicketQuantity] = useState(DEFAULT_MAX_TICKET_QUANTITY);

  useEffect(() => {
    setItems(loadCart());
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
  }, [items, hydrated]);

  const addItem = useCallback((item: Omit<CartItem, "quantity"> & { quantity?: number }) => {
    const cap = Math.max(1, maxTicketQuantity);
    const qty = Math.max(1, Math.min(cap, item.quantity ?? 1));
    const seatIds = item.seatIds && item.seatIds.length > 0 ? item.seatIds : undefined;
    setItems((prev) => {
      const existing = prev.find(
        (i) => i.eventId === item.eventId && (i.ticketName || "").trim() === (item.ticketName || "").trim()
      );
      if (existing) {
        const mergedSeatIds = seatIds
          ? [...(existing.seatIds || []), ...seatIds].slice(0, cap)
          : existing.seatIds;
        const newQty = mergedSeatIds ? mergedSeatIds.length : Math.min(existing.available, cap, existing.quantity + qty);
        if (newQty <= 0) return prev.filter((i) => !(i.eventId === item.eventId && (i.ticketName || "").trim() === (item.ticketName || "").trim()));
        return prev.map((i) =>
          i.eventId === item.eventId && (i.ticketName || "").trim() === (item.ticketName || "").trim()
            ? { ...i, quantity: newQty, seatIds: mergedSeatIds, available: Math.max(i.available, item.available) } : i
        );
      }
      return [...prev, { ...item, quantity: seatIds ? Math.min(seatIds.length, cap) : Math.min(item.available, cap, qty), seatIds }];
    });
  }, [maxTicketQuantity]);

  const removeItem = useCallback((ticketId: string) => {
    setItems((prev) => prev.filter((i) => i.ticketId !== ticketId));
  }, []);

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

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
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
