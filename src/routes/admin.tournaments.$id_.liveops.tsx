import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  Activity,
  Clock,
  Users,
  Pencil,
  KeyRound,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminGetTournament } from "@/lib/admin.functions";
import { adminLiveOpsSummary } from "@/lib/liveops.functions";

export const Route = createFileRoute("/admin/tournaments/$id_/liveops")({
  component: LiveOpsPage,
});

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleString();
}

function StatCard({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "default" | "warn" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "text-destructive"
      : tone === "warn"
        ? "text-amber-600 dark:text-amber-400"
        : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`mt-2 text-3xl font-bold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}

function LiveOpsPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();

  const tQ = useQuery({
    queryKey: ["admin", "tournament", id],
    queryFn: () => adminGetTournament({ data: { id } }),
  });

  const summaryQ = useQuery({
    queryKey: ["admin", "liveops", id],
    queryFn: () => adminLiveOpsSummary({ data: { tournamentId: id } }),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel(`liveops-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hole_scores", filter: `tournament_id=eq.${id}` },
        () => queryClient.invalidateQueries({ queryKey: ["admin", "liveops", id] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hole_score_audit", filter: `tournament_id=eq.${id}` },
        () => queryClient.invalidateQueries({ queryKey: ["admin", "liveops", id] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "override_code_redemptions", filter: `tournament_id=eq.${id}` },
        () => queryClient.invalidateQueries({ queryKey: ["admin", "liveops", id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  const s = summaryQ.data;

  return (
    <div>
      <Link
        to="/admin/tournaments/$id"
        params={{ id }}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Back
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Activity className="h-6 w-6 text-primary" />
            Live ops
          </h1>
          <p className="text-sm text-muted-foreground">
            {tQ.data?.name ?? "…"}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Live · refreshes every 30s
        </div>
      </div>

      {summaryQ.isLoading && !s ? (
        <div className="h-32 animate-pulse rounded-lg bg-muted" />
      ) : summaryQ.error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load: {(summaryQ.error as Error).message}
        </div>
      ) : s ? (
        <>
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={<Users className="h-3.5 w-3.5" />}
              label="Teams not scoring"
              value={s.teamsNotScoring.length}
              tone={s.teamsNotScoring.length ? "warn" : "default"}
            />
            <StatCard
              icon={<Clock className="h-3.5 w-3.5" />}
              label="Stalled 30+ min"
              value={s.stalledTeams.length}
              tone={s.stalledTeams.length ? "danger" : "default"}
            />
            <StatCard
              icon={<Pencil className="h-3.5 w-3.5" />}
              label="Late edits today"
              value={s.lateEditCountToday}
            />
            <StatCard
              icon={<KeyRound className="h-3.5 w-3.5" />}
              label="Code redemptions today"
              value={s.redemptionsToday}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="rounded-lg border border-border bg-card">
              <header className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">Teams to chase</h2>
                <p className="text-xs text-muted-foreground">
                  Not yet scoring or idle 30+ minutes
                </p>
              </header>
              <div className="divide-y divide-border">
                {s.stalledTeams.length === 0 && s.teamsNotScoring.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                    Every team is on pace. 🎉
                  </p>
                ) : (
                  <>
                    {s.stalledTeams.map((t) => (
                      <div key={`stall-${t.team_id}`} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-foreground">
                              {t.team_name}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {t.captain_email}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-sm font-semibold text-destructive">
                              {t.minutes_idle}m idle
                            </div>
                            <div className="text-xs text-muted-foreground">
                              On hole {t.current_hole}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {s.teamsNotScoring
                      .filter((t) => !s.stalledTeams.some((x) => x.team_id === t.team_id))
                      .map((t) => (
                        <div key={`nostart-${t.team_id}`} className="px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-foreground">
                                {t.team_name}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {t.captain_email}
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="text-xs font-medium text-amber-600 dark:text-amber-400">
                                Not started
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Starts hole {t.start_hole}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </>
                )}
              </div>
            </section>

            <div className="space-y-6">
              <section className="rounded-lg border border-border bg-card">
                <header className="border-b border-border px-4 py-3">
                  <h2 className="text-sm font-semibold text-foreground">Recent late edits</h2>
                  <p className="text-xs text-muted-foreground">
                    Updates to previously saved scores
                  </p>
                </header>
                <div className="divide-y divide-border">
                  {s.recentLateEdits.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No edits yet.
                    </p>
                  ) : (
                    s.recentLateEdits.map((e) => (
                      <div key={e.id} className="px-4 py-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-medium text-foreground">
                              {e.team_name} · Hole {e.hole_number}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {e.changed_by_email ?? "system"} · {fmtRelative(e.changed_at)}
                            </div>
                            {e.edit_reason && (
                              <div className="mt-0.5 truncate text-xs italic text-muted-foreground">
                                "{e.edit_reason}"
                              </div>
                            )}
                          </div>
                          <div className="shrink-0 font-mono text-xs text-muted-foreground">
                            {e.old_strokes ?? "—"} → <span className="font-semibold text-foreground">{e.new_strokes ?? "—"}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-lg border border-border bg-card">
                <header className="border-b border-border px-4 py-3">
                  <h2 className="text-sm font-semibold text-foreground">Recent code redemptions</h2>
                  <p className="text-xs text-muted-foreground">
                    Captain logins via override code
                  </p>
                </header>
                <div className="divide-y divide-border">
                  {s.recentRedemptions.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No redemptions yet.
                    </p>
                  ) : (
                    s.recentRedemptions.map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                        <div className="flex min-w-0 items-center gap-2">
                          {r.success ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                          )}
                          <div className="min-w-0">
                            <div className="truncate font-medium text-foreground">
                              {r.captain_email}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {r.team_name ?? (r.success ? "" : r.failure_reason ?? "failed")}
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0 text-xs text-muted-foreground">
                          {fmtRelative(r.redeemed_at)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}