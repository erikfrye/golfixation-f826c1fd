import { useEffect, useState, useSyncExternalStore } from "react";
import { getQueueForTeam, type QueueSnapshot } from "@/lib/offline-queue";

export function useOfflineQueue(teamId: string | undefined) {
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const snapshot = useSyncExternalStore<QueueSnapshot>(
    (cb) => {
      if (!teamId) return () => {};
      const q = getQueueForTeam(teamId);
      return q.subscribe(() => cb());
    },
    () => {
      if (!teamId)
        return { items: [], syncing: false, online, lastSyncedAt: null } as QueueSnapshot;
      return getQueueForTeam(teamId).snapshot();
    },
    () => ({ items: [], syncing: false, online: true, lastSyncedAt: null }) as QueueSnapshot,
  );

  return {
    ...snapshot,
    online,
    queue: teamId ? getQueueForTeam(teamId) : null,
  };
}