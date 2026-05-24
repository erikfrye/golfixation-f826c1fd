import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function getAdminClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function assertAdmin(userId: string) {
  const admin = getAdminClient();
  const { data, error } = await admin.from("admins").select("id").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: not an admin");
  return admin;
}

/* Admin: list tournaments including override_code */
export const adminListTournaments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context.userId);
    const { data, error } = await admin
      .from("tournaments")
      .select("id, name, status, num_holes, format, override_code, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/* Admin: get one tournament with override_code */
export const adminGetTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await assertAdmin(context.userId);
    const { data: row, error } = await admin
      .from("tournaments")
      .select("id, name, status, num_holes, format, override_code, tee_shot_minimum, about_content, mulligans_enabled, start_date, start_format")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

/* Admin: list teams (with captain_email) for a tournament */
export const adminListTeams = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tournamentId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await assertAdmin(context.userId);
    const { data: rows, error } = await admin
      .from("teams")
      .select("id, name, captain_email, start_hole")
      .eq("tournament_id", data.tournamentId)
      .order("created_at");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/* Captain: list my own teams via the authenticated email */
export const listMyCaptainTeams = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = getAdminClient();
    const email = (context.claims as { email?: string }).email?.toLowerCase();
    if (!email) return [];
    const { data, error } = await admin
      .from("teams")
      .select("id, name, tournament_id, tournaments(id, name, status, num_holes)")
      .ilike("captain_email", email);
    if (error) throw new Error(error.message);
    return data ?? [];
  });