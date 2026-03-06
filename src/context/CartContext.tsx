"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

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
}

interface CartContextValue {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  removeItem: (ticketId: string) => void;
  updateQuantity: (ticketId: string, quantity: number) => void;
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

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(loadCart());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveCart(items);
  }, [items, hydrated]);

  const addItem = useCallback((item: Omit<CartItem, "quantity"> & { quantity?: number }) => {
    const qty = Math.max(1, Math.min(10, item.quantity ?? 1));
    setItems((prev) => {
      const existing = prev.find((i) => i.ticketId === item.ticketId);
      if (existing) {
        const newQty = Math.min(existing.available, existing.quantity + qty);
        if (newQty <= 0) return prev.filter((i) => i.ticketId !== item.ticketId);
        return prev.map((i) =>
          i.ticketId === item.ticketId ? { ...i, quantity: newQty } : i
        );
      }
      return [...prev, { ...item, quantity: Math.min(item.available, qty) }];
    });
  }, []);

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
