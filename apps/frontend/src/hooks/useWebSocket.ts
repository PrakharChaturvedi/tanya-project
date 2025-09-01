"use client";
import { useEffect, useRef } from "react";

type MessageHandler = (data: any) => void;

export default function useWebSocket(
  url: string,
  onMessage: MessageHandler
) {
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("Connected to backend WebSocket");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (err) {
        console.error("Failed to parse WS message", err);
      }
    };

    ws.onclose = () => {
      console.log("Disconnected from backend");
    };

    return () => {
      ws.close();
    };
  }, [url, onMessage]);

  const send = (msg: object) => {
    wsRef.current?.send(JSON.stringify(msg));
  };

  return { send };
}
