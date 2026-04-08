"use client";

import { useEffect } from "react";

export function Tracker() {
  useEffect(() => {
    void fetch("/api/track", { method: "POST" }).catch((error) => {
      console.error("Failed to track visit", error);
    });
  }, []);

  return null;
}
