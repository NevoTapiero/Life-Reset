"use client";

import { useEffect } from "react";
import { applyExtras } from "@/lib/extras";

// Puts this device's switched-on extras on <html> once the app loads.
export default function ExtrasApplier() {
  useEffect(() => {
    applyExtras();
  }, []);
  return null;
}
