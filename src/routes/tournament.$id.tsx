import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Flag, ChevronLeft, RefreshCw, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/tournament/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Leaderboard — Golfixation` },
      { name: "description", content: `Live leaderboard for tournament ${params.id}.` },
    ],
  }),
  component: TournamentPage,
});

type Tournament = {
  id: string;
  name: string;
  status: string;
  num_holes: number;
  format: string;
};
type Team = { id: string; name: string };
type Hole = { hole_number: number; par: number };
type Score = { team_id: string; hole_number: number; strokes: number };

function TournamentPage() {
  const { id } = Route.useParams();
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  const tournamentQ = useQuery({
    queryKey: ["tournament", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("id, name, status, num_holes, format")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as Tournament | null;
    },
  });

  const holesQ = useQuery({
    queryKey: ["holes", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("holes")
        .select("hole_number, par")
        .eq("tournament_id", id)
        .order("hole_number");
      if (error) throw error;
      return (data ?? []) as Hole[];
    },
  });

  const teamsQ = useQuery({
    queryKey: ["teams", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name")
        .eq("tournament_id", id);
      if (error) throw error;
      return (data ?? []) as Team[];
    },
  });

  const scoresQ = useQuery({
    queryKey: ["scores", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hole_scores")
        .select("team_id, hole_number, strokes")
        .eq("tournament_id", id);
      if (error) throw error;
      return (data ?? []) as Score[];
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`tournament-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hole_scores", filter: `tournament_id=eq.${id}` },
        () => {
          scoresQ.refetch();
          setLastUpdated(new Date());
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, scoresQ]);

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
      // Only-played-holes ranking: lowest net first, tiebreaker more holes played
      if (a.net !== b.net) return a.net - b.net;
      return b.holesPlayed - a.holesPlayed;
    });
    // Assign tied positions
    let lastNet: number | null = null;
    let lastRank = 0;
    const ranked = rows.map((r, i) => {
      const rank = r.net === lastNet ? lastRank : i + 1;
      lastNet = r.net;
      lastRank = rank;
      return { ...r, rank };
    });
    // Mark ties with T prefix
    const counts = new Map<number, number>();
    ranked.forEach((r) => counts.set(r.rank, (counts.get(r.rank) ?? 0) + 1));
    return ranked.map((r) => ({ ...r, isTied: (counts.get(r.rank) ?? 0) > 1 }));
  }, [holesQ.data, teamsQ.data, scoresQ.data]);

  const isLoading = tournamentQ.isLoading || holesQ.isLoading || teamsQ.isLoading || scoresQ.isLoading;
  const tournament = tournamentQ.data;
  const totalHoles = tournament?.num_holes ?? 18;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
            Tournaments
          </Link>
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
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {isLoading ? (
          <div className="h-32 animate-pulse rounded-lg bg-muted" />
        ) : !tournament ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Tournament not found.
          </div>
        ) : (
          <>
            <div className="mb-6">
              <div className="flex items-center gap-2">
                <Flag className="h-5 w-5 text-primary" />
                <h1 className="text-2xl font-bold tracking-tight text-foreground">{tournament.name}</h1>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {tournament.format === "texas_scramble" ? "Texas Scramble" : "Scramble"} · {tournament.num_holes} holes ·{" "}
                <span className="capitalize">{tournament.status}</span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Last updated {lastUpdated.toLocaleTimeString()}
              </p>
            </div>

            {leaderboard.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
                No teams yet.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border bg-card">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Pos</th>
                      <th className="px-3 py-2 text-left font-semibold">Team</th>
                      <th className="px-3 py-2 text-right font-semibold">Thru</th>
                      <th className="px-3 py-2 text-right font-semibold">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((row) => (
                      <ScoreRow
                        key={row.team.id}
                        row={row}
                        totalHoles={totalHoles}
                        holes={holesQ.data ?? []}
                        scores={(scoresQ.data ?? []).filter((s) => s.team_id === row.team.id)}
                        expanded={expandedTeam === row.team.id}
                        onToggle={() =>
                          setExpandedTeam(expandedTeam === row.team.id ? null : row.team.id)
                        }
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function ScoreRow({
  row,
  totalHoles,
  holes,
  scores,
  expanded,
  onToggle,
}: {
  row: { team: Team; holesPlayed: number; totalStrokes: number; net: number; rank: number; isTied: boolean };
  totalHoles: number;
  holes: Hole[];
  scores: Score[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const scoreByHole = new Map(scores.map((s) => [s.hole_number, s.strokes]));
  return (
    <>
      <tr
        className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30"
        onClick={onToggle}
      >
        <td className="px-3 py-3 font-mono text-foreground">
          {row.isTied ? `T${row.rank}` : row.rank}
        </td>
        <td className="px-3 py-3 font-medium text-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ChevronDown
              className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                expanded ? "" : "-rotate-90"
              }`}
            />
            {row.team.name}
          </span>
        </td>
        <td className="px-3 py-3 text-right font-mono text-muted-foreground">
          {row.holesPlayed}/{totalHoles}
        </td>
        <td className="px-3 py-3 text-right font-mono font-semibold text-foreground">
          {formatNet(row.net, row.holesPlayed)}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-border bg-muted/20 last:border-0">
          <td colSpan={4} className="px-3 py-3">
            <div className="overflow-x-auto">
              <table className="w-full min-w-max text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1 text-left font-semibold">Hole</th>
                    {holes.map((h) => (
                      <th key={h.hole_number} className="px-2 py-1 text-center font-mono font-semibold">
                        {h.hole_number}
                      </th>
                    ))}
                    <th className="px-2 py-1 text-center font-semibold">Tot</th>
                  </tr>
                  <tr className="text-muted-foreground">
                    <th className="px-2 py-1 text-left font-normal">Par</th>
                    {holes.map((h) => (
                      <th key={h.hole_number} className="px-2 py-1 text-center font-mono font-normal">
                        {h.par}
                      </th>
                    ))}
                    <th className="px-2 py-1 text-center font-mono font-normal">
                      {holes.reduce((s, h) => s + h.par, 0)}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-2 py-1 text-left font-semibold text-foreground">Score</td>
                    {holes.map((h) => {
                      const v = scoreByHole.get(h.hole_number);
                      return (
                        <td key={h.hole_number} className="px-2 py-1 text-center font-mono">
                          {v == null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <ScoreCell strokes={v} par={h.par} />
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2 py-1 text-center font-mono font-semibold text-foreground">
                      {row.totalStrokes || "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function ScoreCell({ strokes, par }: { strokes: number; par: number }) {
  const diff = strokes - par;
  let cls = "text-foreground";
  let wrap = "";
  if (diff <= -2) wrap = "inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-primary";
  else if (diff === -1) wrap = "inline-flex h-6 w-6 items-center justify-center rounded-full border border-primary";
  else if (diff === 1) wrap = "inline-flex h-6 w-6 items-center justify-center border border-muted-foreground/40";
  else if (diff >= 2) wrap = "inline-flex h-6 w-6 items-center justify-center border-2 border-destructive/60 text-destructive";
  return <span className={`${wrap} ${cls}`}>{strokes}</span>;
}

function formatNet(net: number, holesPlayed: number): string {
  if (holesPlayed === 0) return "—";
  if (net === 0) return "E";
  return net > 0 ? `+${net}` : `${net}`;
}