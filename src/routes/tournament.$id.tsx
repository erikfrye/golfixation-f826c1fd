import { createFileRoute, Link } from "@tanstack/react-router";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Flag, ChevronLeft, RefreshCw, ChevronDown, ChevronRight, X, Pencil, Trophy } from "lucide-react";
import { AboutButton } from "@/components/about-dialog";

export const Route = createFileRoute("/tournament/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Leaderboard — Golfixation` },
      { name: "description", content: `Live leaderboard for tournament ${params.id}.` },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    teamId: typeof search.teamId === "string" ? search.teamId : undefined,
  }),
  component: TournamentPage,
});

type Tournament = {
  id: string;
  name: string;
  status: string;
  num_holes: number;
  format: string;
  about_content: string | null;
  mulligans_enabled: boolean;
  location: string | null;
  start_date: string | null;
};
type Team = { id: string; name: string };
type Hole = { hole_number: number; par: number };
type Score = {
  team_id: string;
  hole_number: number;
  strokes: number;
  tee_shot_player_id: string | null;
  mulligan_player_id: string | null;
};
type Player = { id: string; name: string; team_id: string };

function TournamentPage() {
  const { id } = Route.useParams();
  const { teamId: captainTeamId } = Route.useSearch();
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [modal, setModal] = useState<{ teamId: string; hole: number } | null>(null);

  const tournamentQ = useQuery({
    queryKey: ["tournament", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("id, name, status, num_holes, format, about_content, mulligans_enabled, location, start_date")
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
      const { data, error } = await supabase.from("teams").select("id, name").eq("tournament_id", id);
      if (error) throw error;
      return (data ?? []) as Team[];
    },
  });

  const playersQ = useQuery({
    queryKey: ["players", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("team_players").select("id, name, team_id").eq("tournament_id", id);
      if (error) throw error;
      return (data ?? []) as Player[];
    },
  });

  const scoresQ = useQuery({
    queryKey: ["scores", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hole_scores")
        .select("team_id, hole_number, strokes, tee_shot_player_id, mulligan_player_id")
        .eq("tournament_id", id);
      if (error) throw error;
      return (data ?? []) as Score[];
    },
  });

  const playerById = useMemo(() => {
    const m = new Map<string, Player>();
    (playersQ.data ?? []).forEach((p) => m.set(p.id, p));
    return m;
  }, [playersQ.data]);

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
      // Teams with no scores entered always sort to the bottom
      const aEmpty = a.holesPlayed === 0;
      const bEmpty = b.holesPlayed === 0;
      if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
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
  const mulligansEnabled = tournament?.mulligans_enabled ?? true;

  return (
    <div className={`min-h-screen bg-background ${captainTeamId ? "pb-16" : ""}`}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold text-foreground">Golfixation</span>
          </Link>
          <div className="flex items-center gap-1">
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
            <AboutButton tournamentAbout={tournament?.about_content} tournamentName={tournament?.name} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to tournaments
        </Link>
        {isLoading ? (
          <div className="mt-4 h-32 animate-pulse rounded-lg bg-muted" />
        ) : !tournament ? (
          <div className="mt-4 rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Tournament not found.
          </div>
        ) : (
          <>
            <div className="mt-3 mb-6">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">{tournament.name}</h1>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {tournament.format === "texas_scramble" ? "Texas Scramble" : "Scramble"} · {tournament.num_holes} holes
                · <span className="capitalize">{tournament.status}</span>
              </p>
              {(tournament.location || tournament.start_date) && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {tournament.location}
                  {tournament.location && tournament.start_date ? " · " : ""}
                  {tournament.start_date
                    ? new Date(tournament.start_date).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : ""}
                </p>
              )}
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
                <div className="grid grid-cols-[3rem_1fr_3.5rem_3.5rem] gap-2 border-b border-border bg-muted/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <div>Pos</div>
                  <div>Team</div>
                  <div className="text-right">Thru</div>
                  <div className="text-right">Score</div>
                </div>
                <ul className="divide-y divide-border">
                  {leaderboard.map((row) => (
                    <ScoreRow
                      key={row.team.id}
                      row={row}
                      totalHoles={totalHoles}
                      holes={holesQ.data ?? []}
                      scores={(scoresQ.data ?? []).filter((s) => s.team_id === row.team.id)}
                      expanded={expandedTeam === row.team.id}
                      onToggle={() => setExpandedTeam(expandedTeam === row.team.id ? null : row.team.id)}
                      onCellClick={(holeNumber) => setModal({ teamId: row.team.id, hole: holeNumber })}
                      mulligansEnabled={mulligansEnabled}
                    />
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </main>

      {modal &&
        (() => {
          const team = (teamsQ.data ?? []).find((t) => t.id === modal.teamId);
          const teamScores = (scoresQ.data ?? []).filter((s) => s.team_id === modal.teamId);
          const score = teamScores.find((s) => s.hole_number === modal.hole) ?? null;
          const hole = (holesQ.data ?? []).find((h) => h.hole_number === modal.hole);
          const holesList = holesQ.data ?? [];
          const idx = holesList.findIndex((h) => h.hole_number === modal.hole);
          const prev = idx > 0 ? holesList[idx - 1] : null;
          const next = idx >= 0 && idx < holesList.length - 1 ? holesList[idx + 1] : null;
          return (
            <HoleDetailModal
              teamName={team?.name ?? ""}
              hole={hole ?? null}
              score={score}
              teeShotName={score?.tee_shot_player_id ? (playerById.get(score.tee_shot_player_id)?.name ?? null) : null}
              mulliganName={score?.mulligan_player_id ? (playerById.get(score.mulligan_player_id)?.name ?? null) : null}
              mulligansEnabled={mulligansEnabled}
              onClose={() => setModal(null)}
              onPrev={prev ? () => setModal({ teamId: modal.teamId, hole: prev.hole_number }) : null}
              onNext={next ? () => setModal({ teamId: modal.teamId, hole: next.hole_number }) : null}
            />
          );
        })()}

      {captainTeamId && (
        <nav className="fixed inset-x-0 bottom-0 z-30 h-14 border-t border-border bg-card/95 backdrop-blur">
          <div className="mx-auto flex h-full max-w-3xl items-center">
            <Link
              to="/captain/team/$teamId"
              params={{ teamId: captainTeamId }}
              className="flex h-full flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              <Pencil className="h-5 w-5" />
              Scoring
            </Link>
            <div className="h-8 w-px bg-border" />
            <span className="flex h-full flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium text-primary">
              <Trophy className="h-5 w-5" />
              Leaderboard
            </span>
          </div>
        </nav>
      )}
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
  onCellClick,
  mulligansEnabled,
}: {
  row: { team: Team; holesPlayed: number; totalStrokes: number; net: number; rank: number; isTied: boolean };
  totalHoles: number;
  holes: Hole[];
  scores: Score[];
  expanded: boolean;
  onToggle: () => void;
  onCellClick: (holeNumber: number) => void;
  mulligansEnabled: boolean;
}) {
  const scoreByHole = new Map(scores.map((s) => [s.hole_number, s]));
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className="grid w-full grid-cols-[3rem_1fr_3.5rem_3.5rem] items-center gap-2 px-3 py-3 text-left text-sm hover:bg-muted/30"
      >
        <span className="font-mono text-foreground">{row.isTied ? `T${row.rank}` : row.rank}</span>
        <span className="flex min-w-0 items-center gap-1.5 font-medium text-foreground">
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${
              expanded ? "" : "-rotate-90"
            }`}
          />
          <span className="truncate">{row.team.name}</span>
        </span>
        <span className="text-right font-mono text-muted-foreground">
          {row.holesPlayed}/{totalHoles}
        </span>
        <span className="text-right font-mono font-semibold text-foreground">
          {formatNet(row.net, row.holesPlayed)}
        </span>
      </button>
      {expanded && (
        <div className="bg-muted/20 px-3 pb-3">
          <div className="-mx-3 overflow-x-auto px-3">
            <table className="min-w-max text-xs">
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
                    const s = scoreByHole.get(h.hole_number);
                    return (
                      <td key={h.hole_number} className="px-2 py-1 text-center font-mono">
                        {s == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onCellClick(h.hole_number)}
                            className="relative inline-flex items-center justify-center hover:opacity-80"
                            aria-label={`Hole ${h.hole_number} details`}
                          >
                            <ScoreCell strokes={s.strokes} par={h.par} />
                            {mulligansEnabled && s.mulligan_player_id && (
                              <span
                                className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-500 ring-1 ring-background"
                                aria-label="Mulligan used"
                              />
                            )}
                          </button>
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
          <p className="mt-2 text-[10px] text-muted-foreground">
            Swipe to see all holes → · Tap a score for details
            {mulligansEnabled && (
              <>
                {" · "}
                <span className="inline-block h-1.5 w-1.5 translate-y-[-1px] rounded-full bg-amber-500" /> mulligan
              </>
            )}
          </p>
        </div>
      )}
    </li>
  );
}

function ScoreCell({ strokes, par }: { strokes: number; par: number }) {
  const diff = strokes - par;
  let cls = "text-foreground";
  let wrap = "";
  if (diff <= -2) wrap = "inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-primary";
  else if (diff === -1) wrap = "inline-flex h-6 w-6 items-center justify-center rounded-full border border-primary";
  else if (diff === 1) wrap = "inline-flex h-6 w-6 items-center justify-center border border-muted-foreground/40";
  else if (diff >= 2)
    wrap = "inline-flex h-6 w-6 items-center justify-center border-2 border-destructive/60 text-destructive";
  return <span className={`${wrap} ${cls}`}>{strokes}</span>;
}

function HoleDetailModal({
  teamName,
  hole,
  score,
  teeShotName,
  mulliganName,
  mulligansEnabled,
  onClose,
  onPrev,
  onNext,
}: {
  teamName: string;
  hole: Hole | null;
  score: Score | null;
  teeShotName: string | null;
  mulliganName: string | null;
  mulligansEnabled: boolean;
  onClose: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && onPrev) onPrev();
      else if (e.key === "ArrowRight" && onNext) onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  const diff = score && hole ? score.strokes - hole.par : 0;
  const diffLabel =
    !score || !hole
      ? ""
      : diff === 0
        ? "Par"
        : diff === -1
          ? "Birdie"
          : diff <= -2
            ? "Eagle"
            : diff === 1
              ? "Bogey"
              : diff === 2
                ? "Double bogey"
                : `+${diff}`;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-foreground/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{teamName}</div>
            <div className="mt-0.5 font-mono text-2xl font-bold text-foreground">Hole {hole?.hole_number ?? "—"}</div>
            {hole && <div className="text-xs text-muted-foreground">Par {hole.par}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3 text-sm">
          {score ? (
            <>
              <DetailRow
                label="Score"
                value={
                  <span className="font-mono font-semibold text-foreground">
                    {score.strokes}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">{diffLabel}</span>
                  </span>
                }
              />
              <DetailRow
                label="Tee shot"
                value={
                  teeShotName ? (
                    <span className="text-foreground">{teeShotName}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )
                }
              />
              {mulligansEnabled && (
                <DetailRow
                  label="Mulligan"
                  value={
                    mulliganName ? (
                      <span className="inline-flex items-center gap-1.5 text-foreground">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        {mulliganName}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">None</span>
                    )
                  }
                />
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No score recorded for this hole.</p>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onPrev && onPrev()}
            disabled={!onPrev}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </button>
          <button
            type="button"
            onClick={() => onNext && onNext()}
            disabled={!onNext}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-2 last:border-b-0 last:pb-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-right text-sm">{value}</span>
    </div>
  );
}

function formatNet(net: number, holesPlayed: number): string {
  if (holesPlayed === 0) return "—";
  if (net === 0) return "E";
  return net > 0 ? `+${net}` : `${net}`;
}
