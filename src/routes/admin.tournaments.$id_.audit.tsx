import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { adminGetScoreAudit, adminGetTournament } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/tournaments/$id_/audit")({
  component: AuditPage,
});

const LATE_EDIT_MS = 15 * 60 * 1000;

function AuditPage() {
  const { id } = Route.useParams();
  const [filter, setFilter] = useState<"all" | "edits" | "late">("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");

  const tQ = useQuery({
    queryKey: ["admin", "tournament", id],
    queryFn: () => adminGetTournament({ data: { id } }),
  });

  const auditQ = useQuery({
    queryKey: ["admin", "audit", id],
    queryFn: () => adminGetScoreAudit({ data: { tournamentId: id } }),
  });

  const teamName = useMemo(() => {
    const m = new Map<string, string>();
    (auditQ.data?.teams ?? []).forEach((t) => m.set(t.id, t.name));
    return m;
  }, [auditQ.data]);

  const playerName = useMemo(() => {
    const m = new Map<string, string>();
    (auditQ.data?.players ?? []).forEach((p) => m.set(p.id, p.name));
    return m;
  }, [auditQ.data]);

  // Compute earliest insert per (team, hole) to detect "late" edits.
  const firstSavedKey = useMemo(() => {
    const m = new Map<string, number>();
    const entries = auditQ.data?.entries ?? [];
    // entries are sorted desc; walk ascending to find first insert per hole
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i];
      const key = `${e.team_id}:${e.hole_number}`;
      if (e.action === "insert" && !m.has(key)) {
        m.set(key, new Date(e.changed_at).getTime());
      }
    }
    return m;
  }, [auditQ.data]);

  const filtered = useMemo(() => {
    const entries = auditQ.data?.entries ?? [];
    return entries.filter((e) => {
      if (teamFilter !== "all" && e.team_id !== teamFilter) return false;
      if (filter === "edits" && e.action === "insert") return false;
      if (filter === "late") {
        const first = firstSavedKey.get(`${e.team_id}:${e.hole_number}`);
        if (!first) return false;
        const elapsed = new Date(e.changed_at).getTime() - first;
        if (e.action === "insert" || elapsed <= LATE_EDIT_MS) return false;
      }
      return true;
    });
  }, [auditQ.data, filter, teamFilter, firstSavedKey]);

  const fmtPlayer = (pid: string | null) => (pid ? (playerName.get(pid) ?? "—") : "—");

  return (
    <div>
      <Link
        to="/admin/tournaments/$id"
        params={{ id }}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Back
      </Link>

      <h1 className="mb-1 text-2xl font-bold text-foreground">Score history</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        {tQ.data?.name ?? "Tournament"} · Append-only log of every score change.
      </p>

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as "all" | "edits" | "late")}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">All changes</option>
          <option value="edits">Edits & deletes only</option>
          <option value="late">Late edits (&gt;15 min)</option>
        </select>

        <select
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">All teams</option>
          {(auditQ.data?.teams ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {auditQ.isLoading ? (
        <div className="h-32 animate-pulse rounded-lg bg-muted" />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No entries match the current filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">When</th>
                <th className="px-3 py-2 text-left font-medium">Team</th>
                <th className="px-3 py-2 text-left font-medium">Hole</th>
                <th className="px-3 py-2 text-left font-medium">Action</th>
                <th className="px-3 py-2 text-left font-medium">Strokes</th>
                <th className="px-3 py-2 text-left font-medium">Tee shot</th>
                <th className="px-3 py-2 text-left font-medium">Mulligan</th>
                <th className="px-3 py-2 text-left font-medium">By</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const first = firstSavedKey.get(`${e.team_id}:${e.hole_number}`);
                const isLate =
                  e.action !== "insert" &&
                  first != null &&
                  new Date(e.changed_at).getTime() - first > LATE_EDIT_MS;
                return (
                  <>
                  <tr
                    key={e.id}
                    className={`border-t border-border ${isLate ? "bg-amber-500/5" : ""}`}
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {new Date(e.changed_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">{teamName.get(e.team_id) ?? "—"}</td>
                    <td className="px-3 py-2 font-mono">{e.hole_number}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          e.action === "insert"
                            ? "rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-600 dark:text-emerald-400"
                            : e.action === "update"
                              ? "rounded bg-sky-500/10 px-1.5 py-0.5 text-xs text-sky-600 dark:text-sky-400"
                              : "rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive"
                        }
                      >
                        {e.action}
                        {isLate && " (late)"}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {e.action === "insert"
                        ? e.new_strokes
                        : e.action === "delete"
                          ? e.old_strokes
                          : `${e.old_strokes} → ${e.new_strokes}`}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {e.action === "update" &&
                      e.old_tee_shot_player_id !== e.new_tee_shot_player_id
                        ? `${fmtPlayer(e.old_tee_shot_player_id)} → ${fmtPlayer(e.new_tee_shot_player_id)}`
                        : fmtPlayer(
                            e.action === "delete" ? e.old_tee_shot_player_id : e.new_tee_shot_player_id,
                          )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {e.action === "update" &&
                      e.old_mulligan_player_id !== e.new_mulligan_player_id
                        ? `${fmtPlayer(e.old_mulligan_player_id)} → ${fmtPlayer(e.new_mulligan_player_id)}`
                        : fmtPlayer(
                            e.action === "delete" ? e.old_mulligan_player_id : e.new_mulligan_player_id,
                          )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {e.changed_by_email ?? e.changed_by ?? "—"}
                    </td>
                  </tr>
                  {e.edit_reason && (
                    <tr key={`${e.id}-r`} className={`border-t border-border/50 ${isLate ? "bg-amber-500/5" : ""}`}>
                      <td colSpan={8} className="px-3 pb-2 pt-0 text-xs text-muted-foreground">
                        <span className="text-foreground/70">Reason:</span> {e.edit_reason}
                      </td>
                    </tr>
                  )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}