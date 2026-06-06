import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, Minus, Plus, Check, ChevronRight, Grid3x3, X, HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useExitAnimation } from "@/hooks/use-exit-animation";
import { Textarea } from "@/components/ui/textarea";
import { getQueueForTeam, type HoleScorePayload } from "@/lib/offline-queue";
import { useOfflineQueue } from "@/hooks/use-offline-queue";
import { SyncStatusPill } from "@/components/captain/sync-status-pill";
import { LiveIndicator } from "@/components/live-indicator";

export const Route = createFileRoute("/captain/team/$teamId/")({
  validateSearch: (search: Record<string, unknown>) => ({
    from: search.from === "admin" ? ("admin" as const) : undefined,
  }),
  component: TeamScoring,
});

type Team = {
  id: string;
  name: string;
  tournament_id: string;
  start_hole: number;
};
type Tournament = {
  id: string;
  name: string;
  num_holes: number;
  format: string;
  tee_shot_minimum: number;
  mulligans_enabled: boolean;
};
type Hole = { hole_number: number; par: number };
type Player = { id: string; name: string; mulligans_total: number };
type Score = {
  id: string;
  hole_number: number;
  strokes: number;
  tee_shot_player_id: string | null;
  mulligan_player_id: string | null;
  first_saved_at: string | null;
};

function TeamScoring() {
  const { teamId } = Route.useParams();
  const { from } = Route.useSearch();
  const [currentHole, setCurrentHole] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const queryClient = useQueryClient();

  const teamQ = useQuery({
    queryKey: ["captain-team", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, tournament_id, start_hole")
        .eq("id", teamId)
        .maybeSingle();
      if (error) throw error;
      return data as Team | null;
    },
  });

  const tournamentId = teamQ.data?.tournament_id;

  const tournamentQ = useQuery({
    queryKey: ["captain-tournament", tournamentId],
    enabled: !!tournamentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("id, name, num_holes, format, tee_shot_minimum, mulligans_enabled")
        .eq("id", tournamentId!)
        .maybeSingle();
      if (error) throw error;
      return data as Tournament | null;
    },
  });

  const holesQ = useQuery({
    queryKey: ["captain-holes", tournamentId],
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

  const playersQ = useQuery({
    queryKey: ["captain-players", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_players")
        .select("id, name, mulligans_total")
        .eq("team_id", teamId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Player[];
    },
  });

  const scoresQ = useQuery({
    queryKey: ["captain-scores", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hole_scores")
        .select("id, hole_number, strokes, tee_shot_player_id, mulligan_player_id, first_saved_at")
        .eq("team_id", teamId)
        .order("hole_number");
      if (error) throw error;
      return (data ?? []) as Score[];
    },
  });

  // Realtime subscription for this team's scores
  useEffect(() => {
    const channel = supabase
      .channel(`captain-team-${teamId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hole_scores", filter: `team_id=eq.${teamId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["captain-scores", teamId] });
          setLastUpdated(new Date());
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, queryClient]);

  const team = teamQ.data;
  const tournament = tournamentQ.data;
  const holes = holesQ.data ?? [];
  const players = playersQ.data ?? [];
  const serverScores = scoresQ.data ?? [];

  const { items: queueItems } = useOfflineQueue(teamId);

  const pendingByHole = useMemo(() => {
    const m = new Map<number, (typeof queueItems)[number]>();
    queueItems.forEach((i) => m.set(i.holeNumber, i));
    return m;
  }, [queueItems]);

  // Overlay queued (unsynced) score writes on top of server-confirmed rows
  const scores = useMemo<Score[]>(() => {
    if (queueItems.length === 0) return serverScores;
    const byHole = new Map<number, Score>();
    serverScores.forEach((s) => byHole.set(s.hole_number, s));
    queueItems.forEach((q) => {
      const existing = byHole.get(q.holeNumber);
      byHole.set(q.holeNumber, {
        id: existing?.id ?? `pending-${q.id}`,
        hole_number: q.holeNumber,
        strokes: q.payload.strokes,
        tee_shot_player_id: q.payload.tee_shot_player_id,
        mulligan_player_id: q.payload.mulligan_player_id,
        first_saved_at: existing?.first_saved_at ?? new Date(q.queuedAt).toISOString(),
      });
    });
    return Array.from(byHole.values()).sort((a, b) => a.hole_number - b.hole_number);
  }, [serverScores, queueItems]);

  const scoreByHole = useMemo(() => {
    const m = new Map<number, Score>();
    scores.forEach((s) => m.set(s.hole_number, s));
    return m;
  }, [scores]);

  const teeShotCounts = useMemo(() => {
    const counts = new Map<string, number>();
    scores.forEach((s) => {
      if (s.tee_shot_player_id) counts.set(s.tee_shot_player_id, (counts.get(s.tee_shot_player_id) ?? 0) + 1);
    });
    return counts;
  }, [scores]);

  const mulliganCounts = useMemo(() => {
    const counts = new Map<string, number>();
    scores.forEach((s) => {
      if (s.mulligan_player_id) counts.set(s.mulligan_player_id, (counts.get(s.mulligan_player_id) ?? 0) + 1);
    });
    return counts;
  }, [scores]);

  const isLoading =
    teamQ.isLoading || tournamentQ.isLoading || holesQ.isLoading || playersQ.isLoading || scoresQ.isLoading;
  const isTexasScramble = tournament?.format === "texas_scramble";
  const mulligansEnabled = tournament?.mulligans_enabled ?? true;

  useEffect(() => {
    if (currentHole !== null) return;
    if (!team || !tournament) return;
    const start = team.start_hole || 1;
    const total = tournament.num_holes;
    if (!total) {
      setCurrentHole(start);
      return;
    }
    const playedSet = new Set(scores.map((s) => s.hole_number));
    for (let i = 0; i < total; i++) {
      const h = ((start - 1 + i) % total) + 1;
      if (!playedSet.has(h)) {
        setCurrentHole(h);
        return;
      }
    }
    setCurrentHole(start);
  }, [team, tournament, scores, currentHole]);

  const teeShotsRequiredRemaining = useMemo(() => {
    if (!tournament || !isTexasScramble) return 0;
    return players.reduce((sum, p) => {
      const used = teeShotCounts.get(p.id) ?? 0;
      return sum + Math.max(0, tournament.tee_shot_minimum - used);
    }, 0);
  }, [players, teeShotCounts, tournament, isTexasScramble]);

  const playersNeedingTeeShots = useMemo(() => {
    if (!tournament || !isTexasScramble) return [] as Player[];
    return players.filter((p) => (teeShotCounts.get(p.id) ?? 0) < tournament.tee_shot_minimum);
  }, [players, teeShotCounts, tournament, isTexasScramble]);

  const holesRemaining = (tournament?.num_holes ?? 0) - scores.length;
  const teeShotRestrictionActive =
    isTexasScramble && teeShotsRequiredRemaining > 0 && teeShotsRequiredRemaining >= holesRemaining;

  const totalStrokes = scores.reduce((s, x) => s + x.strokes, 0);
  const playedPar = scores.reduce((s, x) => s + (holes.find((h) => h.hole_number === x.hole_number)?.par ?? 0), 0);
  const net = totalStrokes - playedPar;

  const effectiveHole = currentHole ?? team?.start_hole ?? 1;
  const activeHole = holes.find((h) => h.hole_number === effectiveHole) ?? holes[0];
  const numHoles = tournament?.num_holes ?? holes.length;
  const wrap = (n: number) => ((n - 1 + numHoles) % numHoles) + 1;
  const nextHole = numHoles > 0 ? holes.find((h) => h.hole_number === wrap(effectiveHole + 1)) : undefined;
  const prevHole = numHoles > 0 ? holes.find((h) => h.hole_number === wrap(effectiveHole - 1)) : undefined;

  return (
    <main className="mx-auto max-w-3xl px-4 pt-6 pb-40">
      {from === "admin" && team ? (
        <Link
          to="/admin/tournaments/$id/teams"
          params={{ id: team.tournament_id }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to teams
        </Link>
      ) : (
        <Link
          to="/captain"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to teams
        </Link>
      )}

      {isLoading || !team || !tournament ? (
        <div className="mt-4 h-24 animate-pulse rounded-lg bg-muted" />
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">{team.name}</h1>
                <HelpDialogButton tournament={tournament} />
              </div>
              <p className="text-xs text-muted-foreground">{tournament.name}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <SyncStatusPill teamId={team.id} />
                <LiveIndicator lastUpdated={lastUpdated} />
              </div>
            </div>
            <div className="rounded-md border border-border bg-card px-3 py-2 text-right">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Through {scores.length}</div>
              <div className="font-mono text-lg font-semibold text-foreground">
                {scores.length === 0 ? "—" : net === 0 ? "E" : net > 0 ? `+${net}` : net}
              </div>
            </div>
          </div>

          {isTexasScramble && players.length > 0 && (
            <div className="mt-4 rounded-lg border border-border bg-card p-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tee shots used (min {tournament.tee_shot_minimum} per player)
              </h2>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Min tee shots remaining</span>
                <span
                  className={`font-mono font-semibold ${
                    teeShotRestrictionActive ? "text-destructive" : "text-foreground"
                  }`}
                >
                  {teeShotsRequiredRemaining} / {holesRemaining} holes left
                </span>
              </div>
              {teeShotRestrictionActive && (
                <p className="mt-2 rounded-md bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
                  Restriction: every remaining hole must use a tee shot from{" "}
                  {playersNeedingTeeShots.map((p) => p.name).join(", ")}.
                </p>
              )}
              <ul className="mt-2 space-y-1.5">
                {players.map((p) => {
                  const used = teeShotCounts.get(p.id) ?? 0;
                  const meetsMin = used >= tournament.tee_shot_minimum;
                  const mul = mulliganCounts.get(p.id) ?? 0;
                  return (
                    <li key={p.id} className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{p.name}</span>
                      <span className="flex items-center gap-3 font-mono text-xs">
                        <span className={meetsMin ? "text-primary" : "text-muted-foreground"}>
                          tee {used}/{tournament.tee_shot_minimum}
                        </span>
                        {mulligansEnabled && (
                          <span className={mul > p.mulligans_total ? "text-destructive" : "text-muted-foreground"}>
                            mull {mul}/{p.mulligans_total}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {activeHole && (
            <div className="mt-6">
              <HoleCard
                key={activeHole.hole_number}
                team={team}
                tournament={tournament}
                hole={activeHole}
                players={players}
                isTexasScramble={isTexasScramble}
                mulligansEnabled={mulligansEnabled}
                existing={scoreByHole.get(activeHole.hole_number) ?? null}
                teeShotCounts={teeShotCounts}
                mulliganCounts={mulliganCounts}
                teeShotRestrictionActive={teeShotRestrictionActive}
                playersNeedingTeeShots={playersNeedingTeeShots}
                pendingStatus={
                  pendingByHole.has(activeHole.hole_number)
                    ? pendingByHole.get(activeHole.hole_number)!.attempts >= 3
                      ? "failed"
                      : "pending"
                    : null
                }
                onSaved={() => {
                  if (nextHole) setCurrentHole(nextHole.hole_number);
                }}
              />
            </div>
          )}

          {/* Hole nav */}
          <div className="fixed inset-x-0 bottom-14 z-20 border-t border-border bg-card/95 backdrop-blur">
            <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
              <button
                type="button"
                disabled={!prevHole}
                onClick={() => prevHole && setCurrentHole(prevHole.hole_number)}
                className="flex h-10 w-10 items-center justify-center rounded-md border border-border text-foreground disabled:opacity-40"
                aria-label="Previous hole"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="flex flex-1 items-center justify-center gap-2 rounded-md bg-muted px-4 py-2.5 text-sm font-medium text-foreground"
              >
                <Grid3x3 className="h-4 w-4" />
                Hole {effectiveHole}
              </button>
              <button
                type="button"
                disabled={!nextHole}
                onClick={() => nextHole && setCurrentHole(nextHole.hole_number)}
                className="flex h-10 items-center gap-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-40"
                aria-label="Next hole"
              >
                #{nextHole?.hole_number ?? currentHole}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {pickerOpen && (
            <HolePicker
              holes={holes}
              current={effectiveHole}
              scoreByHole={scoreByHole}
              pendingByHole={pendingByHole}
              onSelect={(n) => {
                setCurrentHole(n);
                setPickerOpen(false);
              }}
              onClose={() => setPickerOpen(false)}
            />
          )}
        </>
      )}
    </main>
  );
}

function HolePicker({
  holes,
  current,
  scoreByHole,
  pendingByHole,
  onSelect,
  onClose,
}: {
  holes: Hole[];
  current: number;
  scoreByHole: Map<number, Score>;
  pendingByHole: Map<number, { attempts: number }>;
  onSelect: (n: number) => void;
  onClose: () => void;
}) {
  const { mounted, leaving, close } = useExitAnimation(true, onClose, 220);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);
  if (!mounted) return null;
  return (
    <div
      className={`fixed inset-0 z-40 flex items-end justify-center bg-foreground/40 pb-14 ${
        leaving ? "animate-backdrop-out" : "animate-backdrop-in"
      }`}
      onClick={() => close()}
    >
      <div
        className={`w-full max-w-3xl rounded-t-2xl bg-card p-5 shadow-lg ${
          leaving ? "animate-sheet-out" : "animate-sheet-in"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Jump to hole</h3>
          <button
            type="button"
            onClick={() => close()}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {holes.map((h) => {
            const filled = scoreByHole.has(h.hole_number);
            const isCurrent = h.hole_number === current;
            const pending = pendingByHole.get(h.hole_number);
            const pendingFailed = pending && pending.attempts >= 3;
            return (
              <button
                key={h.hole_number}
                type="button"
                onClick={() => {
                  onSelect(h.hole_number);
                }}
                className={`relative flex h-14 flex-col items-center justify-center rounded-lg border text-base font-semibold ${
                  isCurrent
                    ? "border-primary text-primary"
                    : filled
                      ? "border-border bg-muted text-foreground"
                      : "border-border text-foreground"
                }`}
              >
                {h.hole_number}
                <span className="text-[10px] font-normal text-muted-foreground">par {h.par}</span>
                {pending && (
                  <span
                    className={`absolute right-1 top-1 h-2 w-2 rounded-full ${
                      pendingFailed ? "bg-destructive" : "bg-amber-500"
                    }`}
                    aria-label={pendingFailed ? "Failed to sync" : "Pending sync"}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function HelpDialogButton({ tournament }: { tournament: Tournament }) {
  const [open, setOpen] = useState(false);
  const { mounted, leaving, close } = useExitAnimation(open, () => setOpen(false), 180);

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
        aria-label="Scoring help"
        onClick={() => setOpen(true)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      {mounted &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className={`fixed inset-0 z-40 flex items-end justify-center bg-foreground/40 pb-14 sm:items-center sm:pb-0 ${
              leaving ? "animate-backdrop-out" : "animate-backdrop-in"
            }`}
            onClick={() => close()}
          >
            <div
              className={`w-full max-w-sm rounded-t-2xl bg-card p-5 shadow-lg sm:rounded-2xl ${
                leaving ? "animate-sheet-out" : "animate-sheet-in"
              }`}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">How scoring works</h3>
                <button
                  type="button"
                  onClick={() => close()}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 text-sm text-foreground">
                {tournament.format === "texas_scramble" && (
                  <div>
                    <h4 className="font-semibold text-foreground">Tee-shot minimums</h4>
                    <p className="mt-1 text-muted-foreground">
                      Every player must have at least {tournament.tee_shot_minimum} of their tee shots selected across
                      the round. The tracker at the top shows how many each player still needs. If you are running out
                      of holes, the app will warn you and restrict tee-shot choices to players who still need them.
                    </p>
                  </div>
                )}
                {tournament.mulligans_enabled && (
                  <div>
                    <h4 className="font-semibold text-foreground">Mulligans</h4>
                    <p className="mt-1 text-muted-foreground">
                      Each player has a set number of mulligans they can use during the round. You can assign a mulligan
                      to any player on a hole. Once a player has used all their allotted mulligans, they cannot use
                      any more.
                    </p>
                  </div>
                )}
                <div>
                  <h4 className="font-semibold text-foreground">Late-edit policy</h4>
                  <p className="mt-1 text-muted-foreground">
                    After a score has been saved for more than 15 minutes, lowering the stroke count requires a reason.
                    This helps tournament admins track changes and catch mistakes. Increasing a score or editing within
                    15 minutes does not require a reason.
                  </p>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function HoleCard({
  team,
  tournament,
  hole,
  players,
  isTexasScramble,
  mulligansEnabled,
  existing,
  teeShotCounts,
  mulliganCounts,
  teeShotRestrictionActive,
  playersNeedingTeeShots,
  pendingStatus,
  onSaved,
}: {
  team: Team;
  tournament: Tournament;
  hole: Hole;
  players: Player[];
  isTexasScramble: boolean;
  mulligansEnabled: boolean;
  existing: Score | null;
  teeShotCounts: Map<string, number>;
  mulliganCounts: Map<string, number>;
  teeShotRestrictionActive: boolean;
  playersNeedingTeeShots: Player[];
  pendingStatus: "pending" | "failed" | null;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [strokes, setStrokes] = useState<number>(existing?.strokes ?? hole.par);
  const [teeShotPlayerId, setTeeShotPlayerId] = useState<string>(existing?.tee_shot_player_id ?? "");
  const [mulliganPlayerId, setMulliganPlayerId] = useState<string>(existing?.mulligan_player_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [validationOpen, setValidationOpen] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const dirty =
    !existing ||
    existing.strokes !== strokes ||
    (existing.tee_shot_player_id ?? "") !== teeShotPlayerId ||
    (existing.mulligan_player_id ?? "") !== mulliganPlayerId;

  const mulliganPlayer = players.find((p) => p.id === mulliganPlayerId) ?? null;
  const mulliganAlreadyUsed = mulliganPlayerId
    ? (mulliganCounts.get(mulliganPlayerId) ?? 0) - (existing?.mulligan_player_id === mulliganPlayerId ? 1 : 0)
    : 0;
  const mulliganOverLimit = !!mulliganPlayer && mulliganAlreadyUsed + 1 > mulliganPlayer.mulligans_total;

  const LATE_EDIT_THRESHOLD_MS = 15 * 60 * 1000;
  const isLateEdit =
    !!existing?.first_saved_at && Date.now() - new Date(existing.first_saved_at).getTime() > LATE_EDIT_THRESHOLD_MS;
  const requiresReason = !!existing && strokes < existing.strokes && isLateEdit;

  const isExtreme = strokes >= hole.par * 2 || strokes <= hole.par - 3;

  const persist = (editReason: string | null) => {
    if (isTexasScramble && !teeShotPlayerId) {
      setError("Select tee-shot player");
      return;
    }
    if (mulliganOverLimit && mulliganPlayer) {
      setError(
        `${mulliganPlayer.name} has no mulligans left (${mulliganPlayer.mulligans_total} allotted, ${mulliganAlreadyUsed} already used).`,
      );
      return;
    }
    setError(null);
    const payload: HoleScorePayload = {
      team_id: team.id,
      tournament_id: tournament.id,
      hole_number: hole.hole_number,
      strokes,
      tee_shot_player_id: isTexasScramble ? teeShotPlayerId || null : null,
      mulligan_player_id: mulligansEnabled ? mulliganPlayerId || null : null,
      last_edit_reason: editReason,
    };
    // Enqueue: always succeeds locally, sync engine handles network.
    getQueueForTeam(team.id).enqueue(payload);
    // Refresh server-side data shortly in case we're online and the write lands fast.
    setTimeout(() => {
      qc.invalidateQueries({ queryKey: ["captain-scores", team.id] });
    }, 1500);
    setReason("");
    setReasonOpen(false);
    setValidationOpen(false);
    setValidationMessage(null);
    onSaved();
  };

  const attemptSave = () => {
    if (requiresReason) {
      setReason("");
      setReasonOpen(true);
      return;
    }
    persist(null);
  };

  const save = () => {
    if (isExtreme) {
      if (strokes >= hole.par * 2) {
        setValidationMessage(
          `You entered ${strokes} strokes on a par ${hole.par}. That's double par or worse — Is this correct?`,
        );
      } else {
        setValidationMessage(
          `You entered ${strokes} strokes on a par ${hole.par}. That's ${hole.par - strokes} under par or better — Is this correct?`,
        );
      }
      setValidationOpen(true);
      return;
    }
    attemptSave();
  };

  const diff = strokes - hole.par;
  const diffLabel =
    diff === 0
      ? "PAR"
      : diff === -1
        ? "BIRDIE"
        : diff === -2
          ? "EAGLE"
          : diff <= -3
            ? "ALBATROSS"
            : diff === 1
              ? "BOGEY"
              : diff === 2
                ? "DBL BOGEY"
                : `+${diff}`;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Hole</div>
          <div className="font-mono text-4xl font-bold text-foreground">#{hole.hole_number}</div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Par</div>
          <div className="font-mono text-2xl font-semibold text-foreground">{hole.par}</div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md bg-muted/40 p-3">
        <span className="text-sm font-semibold text-foreground">Total strokes</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStrokes((s) => Math.max(1, s - 1))}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-muted"
            aria-label="Decrease strokes"
          >
            <Minus className="h-5 w-5" />
          </button>
          <div className="w-14 text-center font-mono text-2xl font-semibold text-foreground">{strokes}</div>
          <button
            type="button"
            onClick={() => setStrokes((s) => s + 1)}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-muted"
            aria-label="Increase strokes"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="mt-2 flex justify-end">
        <span
          className={`inline-flex items-center rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
            diff < 0
              ? "bg-primary/15 text-primary"
              : diff === 0
                ? "bg-primary text-primary-foreground"
                : diff === 1
                  ? "bg-muted text-foreground"
                  : "bg-destructive/15 text-destructive"
          }`}
        >
          {diffLabel}
        </span>
      </div>

      {(isTexasScramble || (mulligansEnabled && players.length > 0)) && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {isTexasScramble && (
            <label className="block text-xs">
              <span className="font-semibold text-foreground">Tee shot used</span>
              {teeShotRestrictionActive && (
                <p className="mt-1 rounded-md bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
                  Must pick: {playersNeedingTeeShots.map((p) => p.name).join(", ")}
                </p>
              )}
              <select
                value={teeShotPlayerId}
                onChange={(e) => setTeeShotPlayerId(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                <option value="">— select player —</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (used {teeShotCounts.get(p.id) ?? 0}/{tournament.tee_shot_minimum})
                  </option>
                ))}
              </select>
            </label>
          )}
          {mulligansEnabled && (
            <label className="block text-xs">
              <span className="font-semibold text-foreground">Mulligan (optional)</span>
              <select
                value={mulliganPlayerId}
                onChange={(e) => setMulliganPlayerId(e.target.value)}
                className={`mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm ${
                  mulliganOverLimit ? "border-destructive" : "border-input"
                }`}
              >
                <option value="">— none —</option>
                {players.map((p) => {
                  const used = mulliganCounts.get(p.id) ?? 0;
                  const effective = used - (existing?.mulligan_player_id === p.id ? 1 : 0);
                  const exhausted = effective >= p.mulligans_total;
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name} (used {used}/{p.mulligans_total}){exhausted ? " — none left" : ""}
                    </option>
                  );
                })}
              </select>
              {mulliganOverLimit && mulliganPlayer && (
                <p className="mt-1 text-[11px] text-destructive">
                  {mulliganPlayer.name} has used all {mulliganPlayer.mulligans_total} mulligan
                  {mulliganPlayer.mulligans_total === 1 ? "" : "s"}.
                </p>
              )}
            </label>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : pendingStatus === "failed" ? (
          <p className="text-[11px] text-destructive">Failed to sync — will retry</p>
        ) : pendingStatus === "pending" ? (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">Pending sync</p>
        ) : existing ? (
          <p className="text-[11px] text-muted-foreground">Saved</p>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={save}
          disabled={!dirty || mulliganOverLimit}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {existing ? (dirty ? "Update & next" : "Saved") : "Save & next"}
        </button>
      </div>

      <AlertDialog open={reasonOpen} onOpenChange={(o) => setReasonOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lowering a saved score</AlertDialogTitle>
            <AlertDialogDescription>
              You're changing hole {hole.hole_number} from{" "}
              <span className="font-mono font-semibold text-foreground">{existing?.strokes}</span> to{" "}
              <span className="font-mono font-semibold text-foreground">{strokes}</span>. Please provide a brief reason
              for the correction. This will be logged with the change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 500))}
            placeholder="e.g. miscounted strokes on the green"
            rows={3}
            autoFocus
          />
          <p className="text-[11px] text-muted-foreground">{reason.trim().length}/500 — minimum 5 characters</p>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={reason.trim().length < 5}
              onClick={(e) => {
                e.preventDefault();
                persist(reason.trim());
              }}
            >
              Save change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={validationOpen}
        onOpenChange={(o) => {
          if (!o) setValidationOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unusual score</AlertDialogTitle>
            <AlertDialogDescription>{validationMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setValidationOpen(false);
                setValidationMessage(null);
              }}
            >
              Cancel, let me fix it
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                attemptSave();
              }}
            >
              Yes, save anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
