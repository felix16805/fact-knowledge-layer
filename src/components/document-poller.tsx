"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function DocumentPoller({ id, status, initialFactCount }: { id: string; status: string; initialFactCount: number }) {
  const router = useRouter();
  const lastFactCount = useRef(initialFactCount);

  useEffect(() => {
    // Only poll if we're not in a terminal state
    if (status === "pending" || status === "processing") {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/documents/${id}/status`);
          if (res.ok) {
            const data = await res.json();
            
            // If the status changed to ready/failed, OR if new facts were extracted,
            // trigger a server-side re-render to update the UI with the fresh data.
            if (data.status !== status || data.fact_count > lastFactCount.current) {
              lastFactCount.current = data.fact_count;
              router.refresh();
            }
          }
        } catch (err) {
          // Ignore polling network errors
        }
      }, 2000);
      
      return () => clearInterval(interval);
    }
  }, [id, status, router]);

  return null;
}
