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
      className={`p-4 rounded-xl shadow-md border flex justify-between items-center transition-colors duration-300 ${
        flash === "green"
          ? "bg-green-100 border-green-400"
          : flash === "red"
          ? "bg-red-100 border-red-400"
          : "bg-white border-gray-200"
      }`}
    >
      <div>
        <h2 className="text-xl font-bold">{ticker}</h2>
        <p className="text-lg font-semibold">
          {displayPrice !== undefined ? `$${displayPrice.toFixed(2)}` : "Loading..."}
        </p>
      </div>

      <button
        className="text-red-500 hover:text-red-700 px-3 py-1 border rounded-md"
        onClick={onRemove}
      >
        Remove
      </button>
    </div>
  );
}
