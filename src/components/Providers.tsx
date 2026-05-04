"use client";

import { CartProvider } from "@/context/CartContext";
import GlobalErrorHandler from "@/components/GlobalErrorHandler";
import RouteKeyWrapper from "@/components/RouteKeyWrapper";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <GlobalErrorHandler>
      <RouteKeyWrapper>
        <CartProvider>{children}</CartProvider>
      </RouteKeyWrapper>
    </GlobalErrorHandler>
  );
}
