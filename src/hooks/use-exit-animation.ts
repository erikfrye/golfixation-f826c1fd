import { useCallback, useEffect, useState } from "react";

/**
 * Manages mount + exit animation lifecycle for overlays.
 *
 * Usage:
 *   const { mounted, leaving, close } = useExitAnimation(open, () => setOpen(false));
 *   if (!mounted) return null;
 *   <div className={leaving ? "animate-backdrop-out" : "animate-backdrop-in"} />
 */
export function useExitAnimation(open: boolean, onClosed: () => void, duration = 200) {
  const [mounted, setMounted] = useState(open);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setLeaving(false);
    } else if (mounted) {
      setLeaving(true);
      const t = setTimeout(() => {
        setMounted(false);
        setLeaving(false);
      }, duration);
      return () => clearTimeout(t);
    }
  }, [open, mounted, duration]);

  const close = useCallback(() => {
    setLeaving(true);
    const t = setTimeout(() => {
      setLeaving(false);
      setMounted(false);
      onClosed();
    }, duration);
    return () => clearTimeout(t);
  }, [onClosed, duration]);

  return { mounted, leaving, close };
}