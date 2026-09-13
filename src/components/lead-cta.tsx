import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { submitLead } from "@/lib/leads.functions";
import { useExitAnimation } from "@/hooks/use-exit-animation";

export function LeadCta() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const { mounted, leaving, close } = useExitAnimation(open, () => setOpen(false), 180);
  const send = useServerFn(submitLead);

  useEffect(() => {
    if (!mounted) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mounted, close]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");
    try {
      await send({ data: { name, email } });
      setStatus("sent");
      setName("");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        err instanceof Error && err.message ? err.message : "Something went wrong. Please try again.",
      );
    }
  };

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 p-3">
        <div className="pointer-events-auto mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-xs text-foreground sm:text-sm">
              Interested in using Golfixation for your own tournament?
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setStatus("idle");
              setOpen(true);
            }}
            className="shrink-0 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:text-sm"
          >
            Get in touch
          </button>
        </div>
      </div>

      {mounted &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className={`fixed inset-0 z-40 flex items-center justify-center bg-foreground/40 p-4 ${
              leaving ? "animate-backdrop-out" : "animate-backdrop-in"
            }`}
            onClick={() => close()}
          >
            <div
              className={`w-full max-w-sm rounded-2xl bg-card p-5 shadow-lg ${
                leaving ? "animate-modal-out" : "animate-modal-in"
              }`}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Tournament inquiry"
            >
              <div className="flex items-start justify-between">
                <h2 className="font-mono text-xl font-bold text-foreground">
                  Run your own tournament
                </h2>
                <button
                  type="button"
                  onClick={() => close()}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {status === "sent" ? (
                <div className="mt-4">
                  <p className="text-sm text-foreground">
                    Thanks! We&apos;ll be in touch shortly.
                  </p>
                  <button
                    type="button"
                    onClick={() => close()}
                    className="mt-4 w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={onSubmit} className="mt-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Leave your details and we&apos;ll reach out about setting up Golfixation for
                    your event.
                  </p>
                  <div>
                    <label htmlFor="lead-name" className="text-xs font-medium text-foreground">
                      Name
                    </label>
                    <input
                      id="lead-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      autoComplete="name"
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="lead-email" className="text-xs font-medium text-foreground">
                      Email
                    </label>
                    <input
                      id="lead-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                    />
                  </div>
                  {status === "error" && (
                    <p className="text-xs text-destructive">{errorMsg}</p>
                  )}
                  <button
                    type="submit"
                    disabled={status === "sending"}
                    className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                  >
                    {status === "sending" ? "Sending…" : "Send"}
                  </button>
                </form>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
