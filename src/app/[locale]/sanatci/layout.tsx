"use client";

import { SimpleAuthProvider } from "@/contexts/SimpleAuthContext";

export default function SanatciLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SimpleAuthProvider>
      {children}
    </SimpleAuthProvider>
  );
}
