import { useEffect, useState, useCallback } from "react";

const KEY = "golfixation:celebrate-muted";

function read(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Device-wide mute toggle for score-celebration SFX.
 * Persists to localStorage and syncs across tabs.
 */
export function useCelebrateMute() {
  const [muted, setMuted] = useState<boolean>(read);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setMuted(e.newValue === "1");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return { muted, toggle };
}