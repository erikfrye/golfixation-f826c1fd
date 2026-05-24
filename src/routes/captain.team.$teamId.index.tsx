import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Minus, Plus, Check, Loader2, ChevronRight, Grid3x3, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/captain/team/$teamId/")({
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
};

function TeamScoring() {
  const { teamId } = Route.useParams();
  const [currentHole, setCurrentHole] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

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
        .select("id, hole_number, strokes, tee_shot_player_id, mulligan_player_id")
        .eq("team_id", teamId)
        .order("hole_number");
      if (error) throw error;
      return (data ?? []) as Score[];
    },
  });

  const team = teamQ.data;
  const tournament = tournamentQ.data;
  const holes = holesQ.data ?? [];
  const players = playersQ.data ?? [];
  const scores = scoresQ.data ?? [];

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

  const isLoading = teamQ.isLoading || tournamentQ.isLoading || holesQ.isLoading || playersQ.isLoading || scoresQ.isLoading;
  const isTexasScramble = tournament?.format === "texas_scramble";
  const mulligansEnabled = tournament?.mulligans_enabled ?? true;

  useEffect(() => {
    if (currentHole === null && team) setCurrentHole(team.start_hole || 1);
  }, [team, currentHole]);

  const teeShotsRequiredRemaining = useMemo(() => {
    if (!tournament || !isTexasScramble) return 0;
    return players.reduce((sum, p) => {
      const used = teeShotCounts.get(p.id) ?? 0;
      return sum + Math.max(0, tournament.tee_shot_minimum - used);
    }, 0);
  }, [players, teeShotCounts, tournament, isTexasScramble]);

  const playersNeedingTeeShots = useMemo(() => {
    if (!tournament || !isTexasScramble) return [] as Player[];
    return players.filter(
      (p) => (teeShotCounts.get(p.id) ?? 0) < tournament.tee_shot_minimum,
    );
  }, [players, teeShotCounts, tournament, isTexasScramble]);

  const holesRemaining = (tournament?.num_holes ?? 0) - scores.length;
  const teeShotRestrictionActive =
    isTexasScramble && teeShotsRequiredRemaining > 0 && teeShotsRequiredRemaining >= holesRemaining;

  const totalStrokes = scores.reduce((s, x) => s + x.strokes, 0);
  const playedPar = scores.reduce(
    (s, x) => s + (holes.find((h) => h.hole_number === x.hole_number)?.par ?? 0),
    0,
  );
  const net = totalStrokes - playedPar;

  const effectiveHole = currentHole ?? team?.start_hole ?? 1;
  const activeHole = holes.find((h) => h.hole_number === effectiveHole) ?? holes[0];
  const numHoles = tournament?.num_holes ?? holes.length;
  const wrap = (n: number) => ((n - 1 + numHoles) % numHoles) + 1;
  const nextHole = numHoles > 0 ? holes.find((h) => h.hole_number === wrap(effectiveHole + 1)) : undefined;
  const prevHole = numHoles > 0 ? holes.find((h) => h.hole_number === wrap(effectiveHole - 1)) : undefined;

  return (
    <main className="mx-auto max-w-3xl px-4 pt-6 pb-40">
      <Link to="/captain" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3.5 w-3.5" />
        Back to teams
      </Link>

      {isLoading || !team || !tournament ? (
        <div className="mt-4 h-24 animate-pulse rounded-lg bg-muted" />
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{team.name}</h1>
              <p className="text-xs text-muted-foreground">{tournament.name}</p>
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
                        <span className={mul > p.mulligans_total ? "text-destructive" : "text-muted-foreground"}>
                          mull {mul}/{p.mulligans_total}
                        </span>
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
                existing={scoreByHole.get(activeHole.hole_number) ?? null}
                teeShotCounts={teeShotCounts}
                mulliganCounts={mulliganCounts}
                teeShotRestrictionActive={teeShotRestrictionActive}
                playersNeedingTeeShots={playersNeedingTeeShots}
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
  onSelect,
  onClose,
}: {
  holes: Hole[];
  current: number;
  scoreByHole: Map<number, Score>;
  onSelect: (n: number) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/40 pb-14" onClick={onClose}>
      <div
        className="w-full max-w-3xl rounded-t-2xl bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Jump to hole</h3>
          <button
            type="button"
            onClick={onClose}
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
            return (
              <button
                key={h.hole_number}
                type="button"
                onClick={() => onSelect(h.hole_number)}
                className={`flex h-14 flex-col items-center justify-center rounded-lg border text-base font-semibold ${
                  isCurrent
                    ? "border-primary text-primary"
                    : filled
                    ? "border-border bg-muted text-foreground"
                    : "border-border text-foreground"
                }`}
              >
                {h.hole_number}
                <span className="text-[10px] font-normal text-muted-foreground">par {h.par}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function HoleCard({
  team,
  tournament,
  hole,
  players,
  isTexasScramble,
  existing,
  teeShotCounts,
  mulliganCounts,
  teeShotRestrictionActive,
  playersNeedingTeeShots,
  onSaved,
}: {
  team: Team;
  tournament: Tournament;
  hole: Hole;
  players: Player[];
  isTexasScramble: boolean;
  existing: Score | null;
  teeShotCounts: Map<string, number>;
  mulliganCounts: Map<string, number>;
  teeShotRestrictionActive: boolean;
  playersNeedingTeeShots: Player[];
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [strokes, setStrokes] = useState<number>(existing?.strokes ?? hole.par);
  const [teeShotPlayerId, setTeeShotPlayerId] = useState<string>(existing?.tee_shot_player_id ?? "");
  const [mulliganPlayerId, setMulliganPlayerId] = useState<string>(existing?.mulligan_player_id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    !existing ||
    existing.strokes !== strokes ||
    (existing.tee_shot_player_id ?? "") !== teeShotPlayerId ||
    (existing.mulligan_player_id ?? "") !== mulliganPlayerId;

  const mulliganPlayer = players.find((p) => p.id === mulliganPlayerId) ?? null;
  const mulliganAlreadyUsed = mulliganPlayerId
    ? (mulliganCounts.get(mulliganPlayerId) ?? 0) -
      (existing?.mulligan_player_id === mulliganPlayerId ? 1 : 0)
    : 0;
  const mulliganOverLimit =
    !!mulliganPlayer && mulliganAlreadyUsed + 1 > mulliganPlayer.mulligans_total;

  const save = async () => {
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
    setSaving(true);
    const payload = {
      team_id: team.id,
      tournament_id: tournament.id,
      hole_number: hole.hole_number,
      strokes,
      tee_shot_player_id: isTexasScramble ? teeShotPlayerId || null : null,
      mulligan_player_id: mulliganPlayerId || null,
    };
    const { error } = await supabase
      .from("hole_scores")
      .upsert(payload, { onConflict: "team_id,hole_number" });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["captain-scores", team.id] });
    onSaved();
  };

  const diff = strokes - hole.par;
  const diffLabel =
    diff === 0 ? "PAR" : diff === -1 ? "BIRDIE" : diff === -2 ? "EAGLE" : diff <= -3 ? "ALBATROSS" : diff === 1 ? "BOGEY" : diff === 2 ? "DBL BOGEY" : `+${diff}`;

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

      {(isTexasScramble || players.length > 0) && (
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
                    {p.name} (used {used}/{p.mulligans_total})
                    {exhausted ? " — none left" : ""}
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
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : existing ? (
          <p className="text-[11px] text-muted-foreground">Saved</p>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving || mulliganOverLimit}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {existing ? (dirty ? "Update & next" : "Saved") : "Save & next"}
        </button>
      </div>
    </div>
  );
}
