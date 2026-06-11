import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Flag, Trophy, ChevronRight } from "lucide-react";
import { AboutButton } from "@/components/about-dialog";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { UserMenu } from "@/components/user-menu";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") setEmail(null);
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  const { data: tournaments, isLoading } = useQuery({
    queryKey: ["tournaments", "public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("id, name, status, num_holes, format, created_at, start_date")
        .in("status", ["active", "completed"])
        .order("start_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      const now = Date.now();
      const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
      const statusRank: Record<string, number> = { active: 0, upcoming: 1, completed: 2 };
      const filtered = (data ?? []).filter((t) => {
        if (t.status !== "completed") return true;
        if (!t.start_date) return true;
        return now - new Date(t.start_date).getTime() <= twoWeeksMs;
      });
      filtered.sort((a, b) => {
        const rankDiff = (statusRank[a.status] ?? 99) - (statusRank[b.status] ?? 99);
        if (rankDiff !== 0) return rankDiff;
        const aTime = a.start_date ? new Date(a.start_date).getTime() : Infinity;
        const bTime = b.start_date ? new Date(b.start_date).getTime() : Infinity;
        if (a.status === "completed") return bTime - aTime;
        return Math.abs(aTime - now) - Math.abs(bTime - now);
      });
      return filtered;
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
          {email ? (
            <div className="flex items-center gap-3">
              <Link
                to="/captain"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {email}
              </Link>
              <button
                onClick={signOut}
                className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
              <AboutButton />
              <ThemeSwitcher />
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Link
                to="/login"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Login
              </Link>
              <AboutButton />
              <ThemeSwitcher />
            </div>
          )}
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

        <div className="mt-8 text-center">
          <Link
            to="/tournaments/past"
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            View past tournaments →
          </Link>
        </div>
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
