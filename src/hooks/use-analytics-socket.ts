"use client";

import { useSocket } from "./use-socket";
import { useRouter } from "next/navigation";

export function useAnalyticsSocket() {
  const router = useRouter();

  useSocket({
    on: {
      "kpi:updated": () => router.refresh(),
      "shipment:created": () => router.refresh(),
      "shipment:updated": () => router.refresh(),
      "shipment:status": () => router.refresh(),
      "sync:refresh_feed": () => router.refresh(),
    }
  });
}
