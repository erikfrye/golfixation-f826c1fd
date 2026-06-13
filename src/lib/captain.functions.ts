import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const RedeemSchema = z.object({
  code: z.string().min(4).max(32),
  email: z.string().email().max(255),
});

export type RedeemInput = z.infer<typeof RedeemSchema>;
export type RedeemAdmin = Pick<SupabaseClient, "from" | "auth"> & Record<string, unknown>;

function buildAdmin(): RedeemAdmin {
  const url = process.env.SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as unknown as RedeemAdmin;
}

export async function redeemOverrideCodeHandler(admin: RedeemAdmin, data: RedeemInput) {
  const code = data.code.trim().toUpperCase();
  const email = data.email.trim().toLowerCase();

  const { data: tournament, error: tErr } = await admin
    .from("tournaments")
    .select("id, name, status")
    .eq("override_code", code)
    .maybeSingle();
  if (tErr) throw new Error(tErr.message);
  if (!tournament) throw new Error("Invalid override code");

  const { data: team, error: teamErr } = await admin
    .from("teams")
    .select("id, name")
    .eq("tournament_id", tournament.id)
    .ilike("captain_email", email)
    .maybeSingle();
  if (teamErr) throw new Error(teamErr.message);
  if (!team) throw new Error("Email is not registered as a captain for this tournament");

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr || !linkData.properties?.hashed_token) {
    throw new Error(linkErr?.message ?? "Could not generate session");
  }

  return {
    tokenHash: linkData.properties.hashed_token,
    email,
    tournamentName: tournament.name,
    teamName: team.name,
  };
}

/**
 * Redeem a tournament override code for a captain email.
 */
export const redeemOverrideCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => RedeemSchema.parse(input))
  .handler(async ({ data }) => redeemOverrideCodeHandler(buildAdmin(), data));