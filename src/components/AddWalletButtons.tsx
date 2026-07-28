"use client";

import React, { useState } from "react";
import { Wallet, Check, Loader2 } from "lucide-react";

interface AddWalletButtonsProps {
  ticketCode: string;
  eventTitle: string;
  eventDate: string;
  eventTime?: string;
  venue?: string;
  seatInfo?: string;
  buyerName?: string;
  className?: string;
}

export default function AddWalletButtons({
  ticketCode,
  eventTitle,
  eventDate,
  eventTime,
  venue,
  seatInfo,
  buyerName,
  className = "",
}: AddWalletButtonsProps) {
  const [loadingApple, setLoadingApple] = useState(false);
  const [addedApple, setAddedApple] = useState(false);

  const handleAppleWallet = async () => {
    setLoadingApple(true);
    try {
      const params = new URLSearchParams({
        ticketCode,
        eventTitle,
        eventDate,
        ...(eventTime ? { eventTime } : {}),
        ...(venue ? { venue } : {}),
        ...(seatInfo ? { seatInfo } : {}),
        ...(buyerName ? { buyerName } : {}),
      });

      const response = await fetch(`/api/wallet/apple?${params.toString()}`);
      if (!response.ok) throw new Error("Apple Pass oluşturulamadı");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ticket-${ticketCode}.pkpass`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setAddedApple(true);
      setTimeout(() => setAddedApple(false), 4000);
    } catch (error) {
      console.error("Apple Wallet hatası:", error);
      alert("Apple Cüzdan bileti indirilirken bir hata oluştu.");
    } finally {
      setLoadingApple(false);
    }
  };

  return (
    <div className={`inline-flex items-center ${className}`}>
      {/* Apple Wallet Button */}
      <button
        onClick={handleAppleWallet}
        disabled={loadingApple}
        className="inline-flex items-center gap-2.5 bg-black hover:bg-slate-900 text-white font-medium px-4 py-2.5 rounded-xl border border-slate-800 shadow-md transition-all active:scale-[0.98] disabled:opacity-60"
        title="Apple Cüzdan'a (Wallet) Ekle"
      >
        {loadingApple ? (
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        ) : addedApple ? (
          <Check className="w-5 h-5 text-emerald-400" />
        ) : (
          <Wallet className="w-5 h-5 text-white" />
        )}
        <div className="flex flex-col text-left leading-tight">
          <span className="text-[10px] text-slate-400 font-normal uppercase tracking-wider">İndir & Ekle</span>
          <span className="text-xs font-semibold">Apple Wallet</span>
        </div>
      </button>
    </div>
  );
}
