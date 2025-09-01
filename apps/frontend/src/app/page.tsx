// src/app/page.tsx
"use client";

import React, { useEffect, useState, useRef } from "react";
import TickerCard from "@/components/TickerCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type PriceMap = Record<string, number>;

export default function HomePage() {
  const [tickers, setTickers] = useState<string[]>(["BTCUSD", "ETHUSD"]);
  const [prices, setPrices] = useState<PriceMap>({});
  const [newTicker, setNewTicker] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  // Connect WebSocket with reconnection logic
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectDelay = 2000; // 2 seconds
    
    // Function to create and setup WebSocket
    const connectWebSocket = () => {
      ws = new WebSocket("ws://localhost:4000/ws");
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("✅ WebSocket connected");
        reconnectAttempts = 0; // Reset reconnect attempts on successful connection
        
        // Subscribe to all current tickers
        tickers.forEach((ticker) =>
          ws?.send(JSON.stringify({ type: "subscribe", tickers: [ticker] }))
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          // backend sends { type: "price", ticker, price }
          if (msg.type === "price" && msg.ticker && typeof msg.price === "number") {
            setPrices((prev) => ({ ...prev, [msg.ticker]: msg.price }));
          } else if (msg.type === "welcome") {
            console.log("Server says:", msg.clientId);
          }
        } catch (err) {
          console.error("Failed to parse WS message:", err);
        }
      };

      ws.onclose = () => {
        console.log("❌ WebSocket closed");
        wsRef.current = null;
        
        // Attempt to reconnect if not at max attempts
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          console.log(`Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts})...`);
          reconnectTimer = setTimeout(connectWebSocket, reconnectDelay);
        } else {
          console.error("Max reconnection attempts reached. Please refresh the page.");
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        ws?.close(); // This will trigger onclose and reconnection logic
      };
    };
    
    // Initial connection
    connectWebSocket();

    // Cleanup function
    return () => {
      if (ws) {
        ws.close();
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
    };
  }, []);

  const addTicker = () => {
    if (!newTicker || tickers.includes(newTicker)) return;

    setTickers((prev) => [...prev, newTicker]);

    wsRef.current?.send(
      JSON.stringify({ type: "subscribe", tickers: [newTicker] })
    );

    setNewTicker("");
  };

  const removeTicker = (ticker: string) => {
    setTickers((prev) => prev.filter((t) => t !== ticker));

    wsRef.current?.send(
      JSON.stringify({ type: "unsubscribe", tickers: [ticker] })
    );

    setPrices((prev) => {
      const { [ticker]: _, ...rest } = prev;
      return rest;
    });
  };

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-center">Live Crypto Prices</h1>

      <div className="flex gap-2 justify-center">
        <Input
          placeholder="Enter ticker (e.g. BTCUSD)"
          value={newTicker}
          onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
        />
        <Button onClick={addTicker}>Add</Button>
      </div>

      <div className="grid gap-4">
        {tickers.map((ticker) => (
          <TickerCard
            key={ticker}
            ticker={ticker}
            price={prices[ticker]}
            onRemove={() => removeTicker(ticker)}
          />
        ))}
      </div>
    </div>
  );
}
