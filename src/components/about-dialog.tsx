import { useQuery } from "@tanstack/react-query";
import { Info, X } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type AboutButtonProps = {
  tournamentAbout?: string | null;
  tournamentName?: string | null;
  className?: string;
};

export function AboutButton({ tournamentAbout, tournamentName, className }: AboutButtonProps) {
  const [open, setOpen] = useState(false);

  const { data: appAbout } = useQuery({
    queryKey: ["app_settings", "about"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("about_content")
        .eq("id", "app")
        .maybeSingle();
      if (error) throw error;
      return data?.about_content ?? "";
    },
    staleTime: 5 * 60 * 1000,
  });

  const override = tournamentAbout?.trim();
  const content = override && override.length > 0 ? override : appAbout ?? "";
  const title = override ? tournamentName || "About this tournament" : "About Golfixation";

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="About"
        onClick={() => setOpen(true)}
        className={
          "inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground " +
          (className ?? "")
        }
      >
        <Info className="h-5 w-5" />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-foreground/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between">
              <div className="font-mono text-2xl font-bold text-foreground">{title}</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 whitespace-pre-wrap text-sm text-foreground">
              {content || "No information has been added yet."}
            </div>
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
        </div>
      )}
    </>
  );
}