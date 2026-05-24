import { useQuery } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="sr-only">App information</DialogDescription>
          </DialogHeader>
          <div className="whitespace-pre-wrap text-sm text-foreground">
            {content || "No information has been added yet."}
          </div>
          <div className="mt-2 border-t border-border pt-3 text-xs text-muted-foreground">
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
        </DialogContent>
      </Dialog>
    </>
  );
}