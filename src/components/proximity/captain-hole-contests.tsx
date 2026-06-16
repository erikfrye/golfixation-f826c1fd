import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Target, Plus, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useRelativeTime } from "@/hooks/use-relative-time";
import {
  type ProximityContest,
  type ProximityEntry,
  KIND_LABEL,
  ELIGIBILITY_LABEL,
} from "./types";

type TeamPlayer = { id: string; name: string };

type Props = {
  tournamentId: string;
  teamId: string;
  teamName: string;
  holeNumber: number;
  players: TeamPlayer[];
  startHole: number;
  numHoles: number;
};

export function CaptainHoleContests({
  tournamentId,
  teamId,
  teamName,
  holeNumber,
  players,
  startHole,
  numHoles,
}: Props) {
  const qc = useQueryClient();

  const contestsQ = useQuery({
    queryKey: ["proximity-contests", tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proximity_contests")
        .select("id, tournament_id, hole_number, name, kind, eligibility, sponsor, sort_order")
        .eq("tournament_id", tournamentId)
        .order("hole_number")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as ProximityContest[];
    },
  });

  const entriesQ = useQuery({
    queryKey: ["proximity-entries", tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proximity_entries")
        .select("id, contest_id, team_id, player_id, player_name_snapshot, team_name_snapshot, note, entered_at, round_position")
        .eq("tournament_id", tournamentId)
        .order("round_position", { ascending: false })
        .order("entered_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProximityEntry[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`proximity-${tournamentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "proximity_entries", filter: `tournament_id=eq.${tournamentId}` },
        () => qc.invalidateQueries({ queryKey: ["proximity-entries", tournamentId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "proximity_contests", filter: `tournament_id=eq.${tournamentId}` },
        () => qc.invalidateQueries({ queryKey: ["proximity-contests", tournamentId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId, qc]);

  const holeContests = (contestsQ.data ?? []).filter((c) => c.hole_number === holeNumber);
  if (holeContests.length === 0) return null;

  const roundPosition = ((holeNumber - startHole + numHoles) % numHoles) + 1;

  return (
    <div className="mt-4 space-y-3">
      {holeContests.map((contest) => {
        const allEntries = (entriesQ.data ?? []).filter((e) => e.contest_id === contest.id);
        return (
          <ContestCard
            key={contest.id}
            contest={contest}
            entries={allEntries}
            teamId={teamId}
            teamName={teamName}
            players={players}
            roundPosition={roundPosition}
          />
        );
      })}
    </div>
  );
}

function ContestCard({
  contest,
  entries,
  teamId,
  teamName,
  players,
  roundPosition,
}: {
  contest: ProximityContest;
  entries: ProximityEntry[];
  teamId: string;
  teamName: string;
  players: TeamPlayer[];
  roundPosition: number;
}) {
  const [open, setOpen] = useState(false);
  const [playerId, setPlayerId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const leader = entries[0] ?? null;

  const submit = async () => {
    if (!playerId) {
      setErr("Pick a player");
      return;
    }
    const player = players.find((p) => p.id === playerId);
    if (!player) {
      setErr("Player not found");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("proximity_entries").insert({
        contest_id: contest.id,
        tournament_id: contest.tournament_id,
        team_id: teamId,
        player_id: player.id,
        player_name_snapshot: player.name,
        team_name_snapshot: teamName,
        note: note.trim() ? note.trim() : null,
        entered_by: auth.user?.id ?? null,
        round_position: roundPosition,
      });
      if (error) throw error;
      setPlayerId("");
      setNote("");
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const recent = showAll ? entries : entries.slice(0, 3);

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-primary" />
            <span className="text-sm font-semibold text-foreground">{contest.name}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            <span className="rounded bg-muted px-1.5 py-0.5">{KIND_LABEL[contest.kind]}</span>
            <span className="rounded bg-muted px-1.5 py-0.5">{ELIGIBILITY_LABEL[contest.eligibility]}</span>
            {contest.sponsor && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary normal-case">
                Sponsor: {contest.sponsor}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setErr(null);
            setOpen(true);
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground"
        >
          <Plus className="h-3 w-3" /> Enter
        </button>
      </div>

      <div className="mt-3 rounded-md bg-muted/40 p-2">
        {leader ? (
          <div className="flex items-center gap-2">
            <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            <div className="min-w-0 flex-1 text-sm">
              <span className="font-semibold text-foreground">{leader.player_name_snapshot}</span>
              <span className="text-muted-foreground"> · {leader.team_name_snapshot}</span>
              {leader.note && <span className="text-muted-foreground"> · {leader.note}</span>}
            </div>
            <RelTime iso={leader.entered_at} />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No entries yet — be the first.</p>
        )}
      </div>

      {entries.length > 1 && (
        <ul className="mt-2 space-y-1">
          {recent.slice(1).map((e) => (
            <li key={e.id} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex-1 truncate">
                <span className="text-foreground">{e.player_name_snapshot}</span> · {e.team_name_snapshot}
                {e.note && ` · ${e.note}`}
              </span>
              <RelTime iso={e.entered_at} small />
            </li>
          ))}
          {!showAll && entries.length > 3 && (
            <li>
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="text-[11px] font-medium text-primary hover:underline"
              >
                Show all {entries.length} entries
              </button>
            </li>
          )}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{contest.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Add a {teamName} player to this proximity contest. The most recent entry becomes the current leader.
            </p>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">Player</span>
              <select
                value={playerId}
                onChange={(e) => setPlayerId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
              >
                <option value="">— select —</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {players.length === 0 && (
                <p className="mt-1 text-[11px] text-destructive">
                  No players on this team yet. Ask the admin to add players.
                </p>
              )}
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">Note (optional)</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 120))}
                placeholder="e.g. 287 yds, 4 ft 2 in"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            {err && <p className="text-xs text-destructive">{err}</p>}
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-sm hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving || !playerId}
              className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {saving ? "Saving…" : "Add entry"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RelTime({ iso, small }: { iso: string; small?: boolean }) {
  const label = useRelativeTime(new Date(iso));
  return (
    <span className={`shrink-0 font-mono ${small ? "text-[10px]" : "text-[11px]"} text-muted-foreground`}>
      {label}
    </span>
  );
}