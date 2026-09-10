import { useQuery } from "@tanstack/react-query";
import { Info, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { useExitAnimation } from "@/hooks/use-exit-animation";

type AboutButtonProps = {
  tournamentAbout?: string | null;
  tournamentName?: string | null;
  className?: string;
};

export function AboutButton({ tournamentAbout, tournamentName, className }: AboutButtonProps) {
  const [open, setOpen] = useState(false);
  const { mounted, leaving, close } = useExitAnimation(open, () => setOpen(false), 180);

  const { data: appSettings } = useQuery({
    queryKey: ["app_settings", "about"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("about_content, captain_survey_url, admin_survey_url")
        .eq("id", "app")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const appAbout = appSettings?.about_content ?? "";

  const override = tournamentAbout?.trim();
  const content = override && override.length > 0 ? override : (appAbout ?? "");
  const title = override ? tournamentName || "About this tournament" : "About Golfixation";

  useEffect(() => {
    if (!mounted) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mounted, close]);

  return (
    <>
      <button
        type="button"
        aria-label="About"
        onClick={() => setOpen(true)}
        className={
          "inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground " +
          (className ?? "")
        }
      >
        <Info className="h-5 w-5" />
      </button>
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
            >
              <div className="flex items-start justify-between">
                <div className="font-mono text-2xl font-bold text-foreground">{title}</div>
                <button
                  type="button"
                  onClick={() => close()}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 whitespace-pre-wrap text-sm text-foreground">
                {content || "No information has been added yet."}
              </div>
              {appSettings?.captain_survey_url && (
                <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                  <p className="text-foreground">
                    Help us improve Golfixation — this 2-minute survey shapes what we build next.
                  </p>
                  <a
                    href={appSettings.captain_survey_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    Open survey
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M7 7h10v10" />
                      <path d="M7 17 17 7" />
                    </svg>
                  </a>
                </div>
              )}
              <div className="mt-5 border-t border-border pt-3 text-xs text-muted-foreground">
                Built with{" "}
                <a
                  href="https://lovable.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  Lovable
                </a>
                .
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
