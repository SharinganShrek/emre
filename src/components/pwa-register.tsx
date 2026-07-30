"use client";

import { useEffect } from "react";

/** Registers the lightweight service worker for installable / offline shell. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    void navigator.serviceWorker.register("/sw.js").catch(() => {
      /* ignore registration failures in unsupported contexts */
    });
  }, []);

  return null;
}
