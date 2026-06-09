import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Flag, ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import { AboutButton } from "@/components/about-dialog";

export const Route = createFileRoute("/tournaments/past")({
  head: () => ({
    meta: [
      { title: "Past tournaments — Golfixation" },
      { name: "description", content: "Archive of completed tournaments and their final leaderboards." },
    ],
  }),
  component: PastTournamentsPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">Failed to load: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm text-muted-foreground">Not found.</div>,
});

function PastTournamentsPage() {
  const { data: tournaments, isLoading } = useQuery({
    queryKey: ["tournaments", "past"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("id, name, status, num_holes, format, start_date")
        .eq("status", "completed")
        .order("start_date", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold text-foreground">Golfixation</span>
          </Link>
          <AboutButton />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Back
        </Link>
        <div className="mb-8 mt-3">
          <h1 className="text-2xl font-bold text-foreground">Past tournaments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Final leaderboards from completed tournaments.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : !tournaments || tournaments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <Trophy className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No completed tournaments yet.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {tournaments.map((t) => (
              <li key={t.id}>
                <Link
                  to="/tournament/$id"
                  params={{ id: t.id }}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary hover:bg-accent/30"
                >
                  <div>
                    <h3 className="font-semibold text-foreground">{t.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t.format === "texas_scramble" ? "Texas Scramble" : "Scramble"} · {t.num_holes} holes
                      {t.start_date ? ` · ${new Date(t.start_date).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}