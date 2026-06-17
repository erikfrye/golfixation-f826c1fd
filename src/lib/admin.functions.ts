import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

/** Typed Supabase admin client. Tests pass a mock cast through this type. */
export type AdminLike = SupabaseClient<Database>;

export function getAdminClient(): AdminLike {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as unknown as AdminLike;
}

export async function assertAdmin(userId: string, admin: AdminLike = getAdminClient()) {
  const { data, error } = await admin.from("admins").select("id").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: not an admin");
  return admin;
}

/* ------------------------- testable handler bodies ------------------------- */

export async function adminListTournamentsHandler(admin: AdminLike, userId: string) {
  const a = await assertAdmin(userId, admin);
  const { data, error } = await a
    .from("tournaments")
    .select("id, name, status, num_holes, format, override_code, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function adminGetTournamentHandler(
  admin: AdminLike,
  userId: string,
  data: { id: string },
) {
  const a = await assertAdmin(userId, admin);
  const { data: row, error } = await a
    .from("tournaments")
    .select(
      "id, name, status, num_holes, format, override_code, tee_shot_minimum, about_content, mulligans_enabled, start_date, start_format, location",
    )
    .eq("id", data.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return row;
}

export async function adminListTeamsHandler(
  admin: AdminLike,
  userId: string,
  data: { tournamentId: string },
) {
  const a = await assertAdmin(userId, admin);
  const { data: rows, error } = await a
    .from("teams")
    .select("id, name, captain_email, start_hole")
    .eq("tournament_id", data.tournamentId)
    .order("created_at");
  if (error) throw new Error(error.message);
  return rows ?? [];
}

export async function listMyCaptainTeamsHandler(admin: AdminLike, email: string | undefined) {
  const normalized = email?.toLowerCase();
  if (!normalized) return [];
  const { data, error } = await admin
    .from("teams")
    .select("id, name, tournament_id, tournaments(id, name, status, num_holes)")
    .ilike("captain_email", normalized);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function adminGetScoreAuditHandler(
  admin: AdminLike,
  userId: string,
  data: { tournamentId: string },
) {
  const a = await assertAdmin(userId, admin);
  const [auditRes, teamsRes, playersRes] = await Promise.all([
    a
      .from("hole_score_audit")
      .select(
        "id, team_id, hole_number, action, old_strokes, new_strokes, old_tee_shot_player_id, new_tee_shot_player_id, old_mulligan_player_id, new_mulligan_player_id, changed_by, changed_by_email, changed_at, edit_reason",
      )
      .eq("tournament_id", data.tournamentId)
      .order("changed_at", { ascending: false })
      .limit(2000),
    a.from("teams").select("id, name").eq("tournament_id", data.tournamentId),
    a.from("team_players").select("id, name").eq("tournament_id", data.tournamentId),
  ]);
  if (auditRes.error) throw new Error(auditRes.error.message);
  if (teamsRes.error) throw new Error(teamsRes.error.message);
  if (playersRes.error) throw new Error(playersRes.error.message);
  return {
    entries: auditRes.data ?? [],
    teams: teamsRes.data ?? [],
    players: playersRes.data ?? [],
  };
}

export async function adminCloneTournamentHandler(
  admin: AdminLike,
  userId: string,
  data: { id: string; name: string },
) {
  const a = await assertAdmin(userId, admin);
  const { data: src, error: srcErr } = await a
    .from("tournaments")
    .select(
      "num_holes, format, tee_shot_minimum, about_content, mulligans_enabled, start_format",
    )
    .eq("id", data.id)
    .maybeSingle();
  if (srcErr) throw new Error(srcErr.message);
  if (!src) throw new Error("Source tournament not found");

  const { data: srcHoles, error: hErr } = await a
    .from("holes")
    .select("hole_number, par, handicap")
    .eq("tournament_id", data.id)
    .order("hole_number");
  if (hErr) throw new Error(hErr.message);

  const { data: newT, error: insErr } = await a
    .from("tournaments")
    .insert({
      name: data.name,
      status: "draft",
      num_holes: src.num_holes,
      format: src.format,
      tee_shot_minimum: src.tee_shot_minimum,
      about_content: src.about_content,
      mulligans_enabled: src.mulligans_enabled,
      start_format: src.start_format,
      override_code: genCode(),
      created_by: userId,
    })
    .select("id")
    .single();
  if (insErr) throw new Error(insErr.message);

  if (srcHoles && srcHoles.length > 0) {
    const rows = srcHoles.map((h) => ({
      tournament_id: newT.id,
      hole_number: h.hole_number,
      par: h.par,
      handicap: h.handicap,
    }));
    const { error: hInsErr } = await a.from("holes").insert(rows);
    if (hInsErr) throw new Error(hInsErr.message);
  }

  const { data: srcContests, error: pcErr } = await a
    .from("proximity_contests")
    .select("hole_number, name, kind, eligibility, sponsor, sort_order")
    .eq("tournament_id", data.id);
  if (pcErr) throw new Error(pcErr.message);

  if (srcContests && srcContests.length > 0) {
    const rows = srcContests.map((c) => ({
      tournament_id: newT.id,
      hole_number: c.hole_number,
      name: c.name,
      kind: c.kind,
      eligibility: c.eligibility,
      sponsor: c.sponsor,
      sort_order: c.sort_order,
    }));
    const { error: pcInsErr } = await a
      .from("proximity_contests")
      .insert(rows);
    if (pcInsErr) throw new Error(pcInsErr.message);
  }

  return { id: newT.id };
}

/* Admin: list tournaments including override_code */
export const adminListTournaments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    adminListTournamentsHandler(getAdminClient(), context.userId),
  );

/* Admin: get one tournament with override_code */
export const adminGetTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) =>
    adminGetTournamentHandler(getAdminClient(), context.userId, data),
  );

/* Admin: list teams (with captain_email) for a tournament */
export const adminListTeams = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tournamentId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) =>
    adminListTeamsHandler(getAdminClient(), context.userId, data),
  );

/* Captain: list my own teams via the authenticated email */
export const listMyCaptainTeams = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    listMyCaptainTeamsHandler(
      getAdminClient(),
      (context.claims as { email?: string }).email,
    ),
  );

/* Admin: fetch score audit log for a tournament */
export const adminGetScoreAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tournamentId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) =>
    adminGetScoreAuditHandler(getAdminClient(), context.userId, data),
  );

/* Admin: clone a tournament (settings + holes as template) */
export function genCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export const adminCloneTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), name: z.string().min(1).max(200) }).parse(d),
  )
  .handler(async ({ context, data }) =>
    adminCloneTournamentHandler(getAdminClient(), context.userId, data),
  );