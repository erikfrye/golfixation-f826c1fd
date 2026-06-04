import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "golfixation:install-dismissed-at";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
}

function recentlyDismissed() {
  try {
    const v = localStorage.getItem(DISMISS_KEY);
    if (!v) return false;
    return Date.now() - Number(v) < DISMISS_MS;
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosMode, setIosMode] = useState(false);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    if (isIos()) {
      setIosMode(true);
      // Slight delay so it doesn't pop instantly
      const t = setTimeout(() => setVisible(true), 1500);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onBip);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 sm:bottom-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:px-0">
      <div className="mx-auto flex max-w-md items-start gap-3 rounded-lg border border-border bg-card p-3 shadow-lg">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Download className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Add Golfixation to your home screen</p>
          {iosMode && !deferred ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tap <Share className="mx-0.5 inline h-3.5 w-3.5 align-text-bottom" /> Share, then{" "}
              <span className="font-medium text-foreground">Add to Home Screen</span> for one-tap access.
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Reopen the leaderboard instantly during the round.
            </p>
          )}
          {!iosMode && deferred && (
            <div className="mt-2 flex gap-2">
              <button
                onClick={install}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                Install
              </button>
              <button
                onClick={dismiss}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Not now
              </button>
            </div>
          )}
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}