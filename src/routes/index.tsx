import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Flag, Trophy, ChevronRight } from "lucide-react";
import { AboutButton } from "@/components/about-dialog";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { data: tournaments, isLoading } = useQuery({
    queryKey: ["tournaments", "public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("id, name, status, num_holes, format, created_at")
        .in("status", ["active", "completed"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-primary" />
            <h1 className="text-sm font-semibold text-foreground">Golfixation</h1>
          </div>
          <div className="flex items-center gap-1">
          <Link
            to="/login"
            className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Login
          </Link>
          <AboutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground">Tournaments</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Live leaderboards update automatically as captains enter scores.
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
            <p className="mt-3 text-sm text-muted-foreground">No active tournaments yet.</p>
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
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{t.name}</h3>
                      <StatusBadge status={t.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t.format === "texas_scramble" ? "Texas Scramble" : "Scramble"} · {t.num_holes} holes
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

function StatusBadge({ status }: { status: string }) {
  const isLive = status === "active";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        isLive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
      }`}
    >
      {isLive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />}
      {status}
    </span>
  );
}
