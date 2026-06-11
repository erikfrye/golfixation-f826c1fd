import { useEffect, useState } from "react";
import { Moon, Sun, Eye, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

const MODES: { value: Mode; label: string; icon: React.ReactNode }[] = [
  { value: "light", label: "Light", icon: <Sun className="h-4 w-4" /> },
  { value: "dark", label: "Dark", icon: <Moon className="h-4 w-4" /> },
  { value: "hc", label: "Outdoor high-contrast", icon: <Eye className="h-4 w-4" /> },
];

export function ThemeSwitcher() {
  const [mode, setMode] = useState<Mode>("light");

  useEffect(() => {
    const m = getInitialTheme();
    setMode(m);
    apply(m);
  }, []);

  const select = (m: Mode) => {
    setMode(m);
    apply(m);
    try {
      window.localStorage.setItem(KEY, m);
    } catch {
      /* ignore */
    }
  };

  const current = MODES.find((m) => m.value === mode)!;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Theme"
          title="Theme"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {current.icon}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {MODES.map((m) => (
          <DropdownMenuItem
            key={m.value}
            className="cursor-pointer"
            onClick={() => select(m.value)}
          >
            <span className="mr-2">{m.icon}</span>
            <span className="flex-1">{m.label}</span>
            {mode === m.value && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
