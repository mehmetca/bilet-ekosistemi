"use client";

import React from "react";

interface EventDetailLayoutProps {
  children: React.ReactNode;
}

export default function EventDetailLayout({ children }: EventDetailLayoutProps) {
  return <div className="min-h-screen bg-[#f5f6f8]">{children}</div>;
}
