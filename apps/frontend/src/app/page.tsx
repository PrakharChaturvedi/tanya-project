// src/app/page.tsx
"use client";

import React, { useEffect, useState, useRef } from "react";
import TickerCard from "@/components/TickerCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type PriceMap = Record<string, number>;

export default function Home() {
  const [tickers, setTickers] = useState<string[]>(["BTCUSD", "ETHUSD"]);
  const [prices, setPrices] = useState<PriceMap>({});
  const [newTicker, setNewTicker] = useState("");
  const [availableTickers, setAvailableTickers] = useState<string[]>([]);
  const [selectedTicker, setSelectedTicker] = useState<string>("");
  const [wsConnected, setWsConnected] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch available tickers from backend
  useEffect(() => {
    fetch("http://localhost:4000/api/tickers")
      .then(response => response.json())
      .then(data => {
        setAvailableTickers(data.tickers);
      })
      .catch(error => {
        console.error("Failed to fetch tickers:", error);
      });
  }, []);

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

  const addSelectedTicker = () => {
    if (!selectedTicker || tickers.includes(selectedTicker)) return;
    
    setTickers((prev) => [...prev, selectedTicker]);

    wsRef.current?.send(
      JSON.stringify({ type: "subscribe", tickers: [selectedTicker] })
    );

    setSelectedTicker("");
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-10 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-primary-400 mb-2">Live Crypto Prices</h1>
          <p className="text-gray-600 dark:text-gray-300">Real-time cryptocurrency price tracker</p>
        </header>

        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex flex-col sm:flex-row gap-4 items-stretch">
            <div className="flex-1 space-y-2">
              <label htmlFor="manual-ticker" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Add Custom Ticker</label>
              <div className="flex gap-2">
                <Input
                  id="manual-ticker"
                  placeholder="Enter ticker (e.g. BTCUSD)"
                  value={newTicker}
                  onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                  className="flex-1 bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                />
                <Button 
                  onClick={addTicker}
                  className="bg-primary-600 hover:bg-primary-700 text-white"
                >
                  Add
                </Button>
              </div>
            </div>
            
            <div className="flex-1 space-y-2">
              <label htmlFor="ticker-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Popular Tickers</label>
              <div className="flex gap-2">
                <select 
                  id="ticker-select"
                  className="flex-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={selectedTicker}
                  onChange={(e) => setSelectedTicker(e.target.value)}
                >
                  <option value="">Select a ticker</option>
                  {availableTickers.map((ticker) => (
                    <option key={ticker} value={ticker}>
                      {ticker}
                    </option>
                  ))}
                </select>
                <Button 
                  onClick={addSelectedTicker}
                  className="bg-primary-600 hover:bg-primary-700 text-white"
                >
                  Add
                </Button>
              </div>
            </div>
          </div>
        </div>

        {tickers.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2">
            {tickers.map((ticker) => (
              <TickerCard
                key={ticker}
                ticker={ticker}
                price={prices[ticker]}
                onRemove={() => removeTicker(ticker)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl shadow-lg">
            <p className="text-gray-500 dark:text-gray-400">No tickers added yet. Add some tickers to track their prices.</p>
          </div>
        )}
      </div>
    </div>
  );
}
