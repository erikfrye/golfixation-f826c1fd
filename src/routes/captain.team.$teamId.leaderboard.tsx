import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { Trophy, ChevronLeft, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/captain/team/$teamId/leaderboard")({
  component: CaptainLeaderboard,
});

type Tournament = { id: string; name: string; num_holes: number; format: string };
type Team = { id: string; name: string };
type Hole = { hole_number: number; par: number };
type Score = { team_id: string; hole_number: number; strokes: number };

function CaptainLeaderboard() {
  const { teamId } = Route.useParams();
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const teamQ = useQuery({
    queryKey: ["captain-leaderboard-team", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, tournament_id")
        .eq("id", teamId)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; name: string; tournament_id: string } | null;
    },
  });

  const tournamentId = teamQ.data?.tournament_id;

  const tournamentQ = useQuery({
    queryKey: ["captain-leaderboard-tournament", tournamentId],
    enabled: !!tournamentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("id, name, num_holes, format")
        .eq("id", tournamentId!)
        .maybeSingle();
      if (error) throw error;
      return data as Tournament | null;
    },
  });

  const teamsQ = useQuery({
    queryKey: ["captain-leaderboard-teams", tournamentId],
    enabled: !!tournamentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name")
        .eq("tournament_id", tournamentId!);
      if (error) throw error;
      return (data ?? []) as Team[];
    },
  });

  const holesQ = useQuery({
    queryKey: ["captain-leaderboard-holes", tournamentId],
    enabled: !!tournamentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("holes")
        .select("hole_number, par")
        .eq("tournament_id", tournamentId!)
        .order("hole_number");
      if (error) throw error;
      return (data ?? []) as Hole[];
    },
  });

  const scoresQ = useQuery({
    queryKey: ["captain-leaderboard-scores", tournamentId],
    enabled: !!tournamentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hole_scores")
        .select("team_id, hole_number, strokes")
        .eq("tournament_id", tournamentId!);
      if (error) throw error;
      return (data ?? []) as Score[];
    },
  });

  useEffect(() => {
    if (!tournamentId) return;
    const channel = supabase
      .channel(`captain-leaderboard-${tournamentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hole_scores", filter: `tournament_id=eq.${tournamentId}` },
        () => {
          scoresQ.refetch();
          setLastUpdated(new Date());
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId, scoresQ]);

  const leaderboard = useMemo(() => {
    if (!holesQ.data || !teamsQ.data || !scoresQ.data) return [];
    const parByHole = new Map(holesQ.data.map((h) => [h.hole_number, h.par]));
    const rows = teamsQ.data.map((team) => {
      const teamScores = scoresQ.data.filter((s) => s.team_id === team.id);
      const holesPlayed = teamScores.length;
      const totalStrokes = teamScores.reduce((sum, s) => sum + s.strokes, 0);
      const totalPar = teamScores.reduce((sum, s) => sum + (parByHole.get(s.hole_number) ?? 0), 0);
      const net = totalStrokes - totalPar;
      return { team, holesPlayed, totalStrokes, net };
    });
    rows.sort((a, b) => {
      if (a.net !== b.net) return a.net - b.net;
      return b.holesPlayed - a.holesPlayed;
    });
    let lastNet: number | null = null;
    let lastRank = 1;
    const ranked = rows.map((r, i) => {
      const rank = r.net === lastNet ? lastRank : i + 1;
      lastNet = r.net;
      lastRank = rank;
      return { ...r, rank };
    });
    const counts = new Map<number, number>();
    ranked.forEach((r) => counts.set(r.rank, (counts.get(r.rank) ?? 0) + 1));
    return ranked.map((r) => ({ ...r, isTied: (counts.get(r.rank) ?? 1) > 1 }));
  }, [holesQ.data, teamsQ.data, scoresQ.data]);

  const isLoading = teamQ.isLoading || tournamentQ.isLoading || holesQ.isLoading || teamsQ.isLoading || scoresQ.isLoading;
  const tournament = tournamentQ.data;

  return (
    <main className="mx-auto max-w-3xl px-4 pt-6 pb-16">
      <Link
        to="/captain/team/$teamId"
        params={{ teamId }}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Back to scoring
      </Link>

      {isLoading || !tournament ? (
        <div className="mt-4 h-24 animate-pulse rounded-lg bg-muted" />
      ) : (
        <>
          <div className="mt-3 flex items-end justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-bold text-foreground">Leaderboard</h1>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {tournament.name} · {tournament.num_holes} holes
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Last updated {lastUpdated.toLocaleTimeString()}
              </p>
            </div>
            <button
              onClick={() => {
                scoresQ.refetch();
                setLastUpdated(new Date());
              }}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>

          {leaderboard.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No scores yet.
            </div>
          ) : (
            <div className="mt-6 overflow-hidden rounded-lg border border-border bg-card">
              <div className="grid grid-cols-[2.5rem_1fr_3.5rem_3.5rem] gap-2 border-b border-border bg-muted/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <div>Pos</div>
                <div>Team</div>
                <div className="text-right">Thru</div>
                <div className="text-right">Score</div>
              </div>
              <ul className="divide-y divide-border">
                {leaderboard.map((row) => (
                  <li
                    key={row.team.id}
                    className="grid grid-cols-[2.5rem_1fr_3.5rem_3.5rem] items-center gap-2 px-3 py-3 text-sm"
                  >
                    <span className="font-mono text-foreground">
                      {row.isTied ? `T${row.rank}` : row.rank}
                    </span>
                    <span className="truncate font-medium text-foreground">{row.team.name}</span>
                    <span className="text-right font-mono text-muted-foreground">
                      {row.holesPlayed}/{tournament.num_holes}
                    </span>
                    <span className="text-right font-mono font-semibold text-foreground">
                      {formatNet(row.net, row.holesPlayed)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function formatNet(net: number, holesPlayed: number): string {
  if (holesPlayed === 0) return "—";
  if (net === 0) return "E";
  return net > 0 ? `+${net}` : `${net}`;
}
