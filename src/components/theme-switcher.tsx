import { useEffect, useState } from "react";
import { Moon, Sun, SunMedium } from "lucide-react";

type Mode = "light" | "dark" | "hc";
const KEY = "gx-theme";

function apply(mode: Mode) {
  const root = document.documentElement;
  root.classList.remove("dark", "hc");
  if (mode === "dark") root.classList.add("dark");
  if (mode === "hc") root.classList.add("hc");
}

export function getInitialTheme(): Mode {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem(KEY) as Mode | null;
  if (saved === "light" || saved === "dark" || saved === "hc") return saved;
  return "light";
}

export function ThemeSwitcher() {
  const [mode, setMode] = useState<Mode>("light");

  useEffect(() => {
    const m = getInitialTheme();
    setMode(m);
    apply(m);
  }, []);

  const next = (m: Mode) => {
    setMode(m);
    apply(m);
    try {
      window.localStorage.setItem(KEY, m);
    } catch {
      /* ignore */
    }
  };

  const cycle = () => {
    const order: Mode[] = ["light", "dark", "hc"];
    next(order[(order.indexOf(mode) + 1) % order.length]);
  };

  const label =
    mode === "light" ? "Light mode" : mode === "dark" ? "Dark mode" : "Outdoor high-contrast mode";
  const Icon = mode === "light" ? Sun : mode === "dark" ? Moon : SunMedium;

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Theme: ${label}. Click to switch.`}
      title={`Theme: ${label}`}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}