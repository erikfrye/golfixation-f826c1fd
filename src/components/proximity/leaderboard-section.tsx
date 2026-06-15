import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Target, Crown, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRelativeTime } from "@/hooks/use-relative-time";
import {
  type ProximityContest,
  type ProximityEntry,
  KIND_LABEL,
  ELIGIBILITY_LABEL,
} from "./types";

export function ProximityLeaderboardSection({ tournamentId }: { tournamentId: string }) {
  const qc = useQueryClient();
  const [historyFor, setHistoryFor] = useState<ProximityContest | null>(null);

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
        .select("id, contest_id, team_id, player_id, player_name_snapshot, team_name_snapshot, note, entered_at")
        .eq("tournament_id", tournamentId)
        .order("entered_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProximityEntry[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`proximity-leaderboard-${tournamentId}`)
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

  const contests = contestsQ.data ?? [];
  if (contests.length === 0) return null;

  const entries = entriesQ.data ?? [];
  const historyEntries = historyFor
    ? entries.filter((e) => e.contest_id === historyFor.id)
    : [];

  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
        <Target className="h-3.5 w-3.5 text-primary" />
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Proximity contests
        </h2>
      </div>
      <ul className="divide-y divide-border">
        {contests.map((c) => {
          const leader = entries.find((e) => e.contest_id === c.id) ?? null;
          const count = entries.filter((e) => e.contest_id === c.id).length;
          return (
            <li key={c.id} className="px-3 py-3">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-7 w-10 shrink-0 items-center justify-center rounded-md border border-border font-mono text-xs">
                  #{c.hole_number}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-semibold text-foreground">{c.name}</span>
                    {c.sponsor && (
                      <span className="text-[10px] uppercase tracking-wide text-primary">
                        Sponsor: {c.sponsor}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <span className="rounded bg-muted px-1.5 py-0.5">{KIND_LABEL[c.kind]}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5">{ELIGIBILITY_LABEL[c.eligibility]}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    {leader ? (
                      <>
                        <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                        <span className="min-w-0 flex-1 truncate">
                          <span className="font-semibold text-foreground">{leader.player_name_snapshot}</span>
                          <span className="text-muted-foreground"> · {leader.team_name_snapshot}</span>
                          {leader.note && <span className="text-muted-foreground"> · {leader.note}</span>}
                        </span>
                        <RelTime iso={leader.entered_at} />
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">No entries yet</span>
                    )}
                  </div>
                </div>
                {count > 0 && (
                  <button
                    type="button"
                    onClick={() => setHistoryFor(c)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
                  >
                    <History className="h-3 w-3" /> History ({count})
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog open={!!historyFor} onOpenChange={(o) => !o && setHistoryFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {historyFor?.name}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                Hole #{historyFor?.hole_number}
              </span>
            </DialogTitle>
          </DialogHeader>
          {historyEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries.</p>
          ) : (
            <ol className="max-h-[60vh] divide-y divide-border overflow-y-auto">
              {historyEntries.map((e, idx) => (
                <li key={e.id} className="flex items-start gap-3 py-2.5 text-sm">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[10px] text-muted-foreground">
                    {idx === 0 ? "★" : historyEntries.length - idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground">{e.player_name_snapshot}</div>
                    <div className="text-xs text-muted-foreground">{e.team_name_snapshot}</div>
                    {e.note && <div className="mt-0.5 text-xs text-foreground">{e.note}</div>}
                  </div>
                  <div className="shrink-0 text-right text-[11px] text-muted-foreground">
                    <RelTime iso={e.entered_at} />
                    <div className="font-mono">
                      {new Date(e.entered_at).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RelTime({ iso }: { iso: string }) {
  const label = useRelativeTime(new Date(iso));
  return <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{label}</span>;
}