import { useEffect, useState } from "react";

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function useRelativeTime(date: Date) {
  const [label, setLabel] = useState(() => formatRelativeTime(date));

  useEffect(() => {
    setLabel(formatRelativeTime(date));
    const id = setInterval(() => {
      setLabel(formatRelativeTime(date));
    }, 5000);
    return () => clearInterval(id);
  }, [date]);

  return label;
}
