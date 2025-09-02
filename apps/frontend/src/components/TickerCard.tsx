// src/components/TickerCard.tsx
"use client";

import React, { useEffect, useState } from "react";

interface Props {
  ticker: string;
  price?: number;
  onRemove: () => void;
}

export default function TickerCard({ ticker, price, onRemove }: Props) {
  const [displayPrice, setDisplayPrice] = useState<number | undefined>(price);
  const [flash, setFlash] = useState<"green" | "red" | null>(null);

  // Update displayed price with flash effect
  useEffect(() => {
    if (price !== undefined && price !== displayPrice) {
      setFlash(price > (displayPrice ?? 0) ? "green" : "red");
      setDisplayPrice(price);
      const timer = setTimeout(() => setFlash(null), 500); // flash duration
      return () => clearTimeout(timer);
    }
  }, [price]);

  return (
    <div
      className={`p-5 rounded-xl shadow-card backdrop-blur-sm flex justify-between items-center transition-all duration-300 ${
        flash === "green"
          ? "bg-green-50/90 border-l-4 border-green-500"
          : flash === "red"
          ? "bg-red-50/90 border-l-4 border-red-500"
          : "bg-white/90 dark:bg-gray-800/90 border-l-4 border-primary-500"
      }`}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold">{ticker}</h2>
          <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full">Crypto</span>
        </div>
        <p className={`text-2xl font-semibold ${flash === "green" ? "text-green-600" : flash === "red" ? "text-red-600" : "text-gray-800 dark:text-gray-200"}`}>
          {displayPrice !== undefined ? `$${displayPrice.toFixed(2)}` : "Loading..."}
        </p>
      </div>

      <button
        className="text-gray-500 hover:text-red-600 p-2 rounded-full transition-colors duration-200 hover:bg-red-50 dark:hover:bg-red-900/20"
        onClick={onRemove}
        aria-label="Remove ticker"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
