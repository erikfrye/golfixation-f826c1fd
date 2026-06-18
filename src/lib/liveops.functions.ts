import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  assertAdmin,
  getAdminClient,
  type AdminLike,
} from "@/lib/admin.functions";

export type TeamMini = {
  team_id: string;
  team_name: string;
  captain_email: string;
  start_hole: number;
};

export type StalledTeam = TeamMini & {
  current_hole: number;
  minutes_idle: number;
  last_activity_at: string | null;
};

export type LateEditRow = {
  id: string;
  team_id: string;
  team_name: string;
  hole_number: number;
  old_strokes: number | null;
  new_strokes: number | null;
  changed_by_email: string | null;
  changed_at: string;
  edit_reason: string | null;
};

export type RedemptionRow = {
  id: string;
  captain_email: string;
  team_id: string | null;
  team_name: string | null;
  success: boolean;
  failure_reason: string | null;
  redeemed_at: string;
};

export type LiveOpsSummary = {
  tournamentId: string;
  generatedAt: string;
  teamsNotScoring: TeamMini[];
  stalledTeams: StalledTeam[];
  lateEditCountToday: number;
  recentLateEdits: LateEditRow[];
  redemptionsToday: number;
  recentRedemptions: RedemptionRow[];
};

const STALL_MINUTES = 30;

function nextUnscoredHole(
  scoredHoles: Set<number>,
  startHole: number,
  numHoles: number,
): number | null {
  for (let i = 0; i < numHoles; i++) {
    const hole = ((startHole - 1 + i) % numHoles) + 1;
    if (!scoredHoles.has(hole)) return hole;
  }
  return null;
}

export async function adminLiveOpsSummaryHandler(
  admin: AdminLike,
  userId: string,
  data: { tournamentId: string },
): Promise<LiveOpsSummary> {
  const a = await assertAdmin(userId, admin);
  const tournamentId = data.tournamentId;

  const [{ data: tournament, error: tErr }, teamsRes, scoresRes] = await Promise.all([
    a.from("tournaments").select("id, num_holes, start_date").eq("id", tournamentId).maybeSingle(),
    a.from("teams").select("id, name, captain_email, start_hole").eq("tournament_id", tournamentId).order("name"),
    a
      .from("hole_scores")
      .select("team_id, hole_number, updated_at")
      .eq("tournament_id", tournamentId),
  ]);
  if (tErr) throw new Error(tErr.message);
  if (!tournament) throw new Error("Tournament not found");
  if (teamsRes.error) throw new Error(teamsRes.error.message);
  if (scoresRes.error) throw new Error(scoresRes.error.message);

  const teams = teamsRes.data ?? [];
  const scores = scoresRes.data ?? [];
  const numHoles = tournament.num_holes ?? 18;
  const startedAt = tournament.start_date ? new Date(tournament.start_date) : null;
  const now = Date.now();

  const byTeam = new Map<
    string,
    { scoredHoles: Set<number>; lastActivityAt: number | null }
  >();
  for (const t of teams) {
    byTeam.set(t.id, { scoredHoles: new Set(), lastActivityAt: null });
  }
  for (const s of scores) {
    const entry = byTeam.get(s.team_id);
    if (!entry) continue;
    entry.scoredHoles.add(s.hole_number);
    const ts = s.updated_at ? new Date(s.updated_at).getTime() : 0;
    if (!entry.lastActivityAt || ts > entry.lastActivityAt) {
      entry.lastActivityAt = ts;
    }
  }

  const teamsNotScoring: TeamMini[] = [];
  const stalledTeams: StalledTeam[] = [];

  for (const t of teams) {
    const entry = byTeam.get(t.id)!;
    const startHole = t.start_hole ?? 1;
    const tm: TeamMini = {
      team_id: t.id,
      team_name: t.name,
      captain_email: t.captain_email,
      start_hole: startHole,
    };

    if (entry.scoredHoles.size === 0) {
      teamsNotScoring.push(tm);
      // Stalled if tournament started 30+ min ago
      if (startedAt && now - startedAt.getTime() >= STALL_MINUTES * 60_000) {
        stalledTeams.push({
          ...tm,
          current_hole: startHole,
          minutes_idle: Math.floor((now - startedAt.getTime()) / 60_000),
          last_activity_at: null,
        });
      }
      continue;
    }

    const current = nextUnscoredHole(entry.scoredHoles, startHole, numHoles);
    if (current === null) continue; // round complete
    const idleMs = entry.lastActivityAt ? now - entry.lastActivityAt : Infinity;
    if (idleMs >= STALL_MINUTES * 60_000) {
      stalledTeams.push({
        ...tm,
        current_hole: current,
        minutes_idle: Math.floor(idleMs / 60_000),
        last_activity_at: entry.lastActivityAt ? new Date(entry.lastActivityAt).toISOString() : null,
      });
    }
  }

  stalledTeams.sort((a, b) => b.minutes_idle - a.minutes_idle);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startIso = startOfToday.toISOString();

  const [editsCountRes, recentEditsRes, redemptionsCountRes, recentRedemptionsRes] =
    await Promise.all([
      a
        .from("hole_score_audit")
        .select("id", { count: "exact", head: true })
        .eq("tournament_id", tournamentId)
        .eq("action", "update")
        .gte("changed_at", startIso),
      a
        .from("hole_score_audit")
        .select(
          "id, team_id, hole_number, old_strokes, new_strokes, changed_by_email, changed_at, edit_reason",
        )
        .eq("tournament_id", tournamentId)
        .eq("action", "update")
        .order("changed_at", { ascending: false })
        .limit(10),
      a
        .from("override_code_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("tournament_id", tournamentId)
        .gte("redeemed_at", startIso),
      a
        .from("override_code_redemptions")
        .select("id, captain_email, team_id, success, failure_reason, redeemed_at")
        .eq("tournament_id", tournamentId)
        .order("redeemed_at", { ascending: false })
        .limit(10),
    ]);

  if (editsCountRes.error) throw new Error(editsCountRes.error.message);
  if (recentEditsRes.error) throw new Error(recentEditsRes.error.message);
  if (redemptionsCountRes.error) throw new Error(redemptionsCountRes.error.message);
  if (recentRedemptionsRes.error) throw new Error(recentRedemptionsRes.error.message);

  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));

  const recentLateEdits: LateEditRow[] = (recentEditsRes.data ?? []).map((r) => ({
    id: r.id,
    team_id: r.team_id,
    team_name: teamNameById.get(r.team_id) ?? "Unknown team",
    hole_number: r.hole_number,
    old_strokes: r.old_strokes,
    new_strokes: r.new_strokes,
    changed_by_email: r.changed_by_email,
    changed_at: r.changed_at,
    edit_reason: r.edit_reason,
  }));

  const recentRedemptions: RedemptionRow[] = (recentRedemptionsRes.data ?? []).map((r) => ({
    id: r.id,
    captain_email: r.captain_email,
    team_id: r.team_id,
    team_name: r.team_id ? (teamNameById.get(r.team_id) ?? null) : null,
    success: r.success,
    failure_reason: r.failure_reason,
    redeemed_at: r.redeemed_at,
  }));

  return {
    tournamentId,
    generatedAt: new Date().toISOString(),
    teamsNotScoring,
    stalledTeams,
    lateEditCountToday: editsCountRes.count ?? 0,
    recentLateEdits,
    redemptionsToday: redemptionsCountRes.count ?? 0,
    recentRedemptions,
  };
}

export const adminLiveOpsSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ tournamentId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) =>
    adminLiveOpsSummaryHandler(getAdminClient(), context.userId, data),
  );