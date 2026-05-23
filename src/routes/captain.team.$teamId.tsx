import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronLeft, Minus, Plus, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/captain/team/$teamId")({
  component: TeamScoring,
});

type Team = {
  id: string;
  name: string;
  tournament_id: string;
};
type Tournament = { id: string; name: string; num_holes: number; format: string; tee_shot_minimum: number };
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

  const teamQ = useQuery({
    queryKey: ["captain-team", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, tournament_id")
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
        .select("id, name, num_holes, format, tee_shot_minimum")
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

  const totalStrokes = scores.reduce((s, x) => s + x.strokes, 0);
  const playedPar = scores.reduce(
    (s, x) => s + (holes.find((h) => h.hole_number === x.hole_number)?.par ?? 0),
    0,
  );
  const net = totalStrokes - playedPar;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
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

          <div className="mt-6 space-y-3">
            {holes.map((hole) => (
              <HoleCard
                key={hole.hole_number}
                team={team}
                tournament={tournament}
                hole={hole}
                players={players}
                isTexasScramble={isTexasScramble}
                existing={scoreByHole.get(hole.hole_number) ?? null}
              />
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function HoleCard({
  team,
  tournament,
  hole,
  players,
  isTexasScramble,
  existing,
}: {
  team: Team;
  tournament: Tournament;
  hole: Hole;
  players: Player[];
  isTexasScramble: boolean;
  existing: Score | null;
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

  const save = async () => {
    if (isTexasScramble && !teeShotPlayerId) {
      setError("Select tee-shot player");
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
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground">Hole {hole.hole_number}</div>
          <div className="text-[11px] text-muted-foreground">Par {hole.par}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStrokes((s) => Math.max(1, s - 1))}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-foreground hover:bg-muted"
            aria-label="Decrease strokes"
          >
            <Minus className="h-4 w-4" />
          </button>
          <div className="w-12 text-center font-mono text-xl font-semibold text-foreground">{strokes}</div>
          <button
            type="button"
            onClick={() => setStrokes((s) => s + 1)}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-foreground hover:bg-muted"
            aria-label="Increase strokes"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {(isTexasScramble || players.length > 0) && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {isTexasScramble && (
            <label className="block text-xs">
              <span className="text-muted-foreground">Tee shot used</span>
              <select
                value={teeShotPlayerId}
                onChange={(e) => setTeeShotPlayerId(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                <option value="">— select player —</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block text-xs">
            <span className="text-muted-foreground">Mulligan (optional)</span>
            <select
              value={mulliganPlayerId}
              onChange={(e) => setMulliganPlayerId(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            >
              <option value="">— none —</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
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
          disabled={!dirty || saving}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          {existing ? (dirty ? "Update" : "Saved") : "Save"}
        </button>
      </div>
    </div>
  );
}