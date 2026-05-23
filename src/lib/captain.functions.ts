import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const RedeemSchema = z.object({
  code: z.string().min(4).max(32),
  email: z.string().email().max(255),
});

/**
 * Redeem a tournament override code for a captain email.
 * Verifies the email is registered as a captain in a tournament with the given override code,
 * then generates a magic-link token the client can verify to sign in.
 */
export const redeemOverrideCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => RedeemSchema.parse(input))
  .handler(async ({ data }) => {
    const url = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const code = data.code.trim().toUpperCase();
    const email = data.email.trim().toLowerCase();

    // Find a tournament with this override code
    const { data: tournament, error: tErr } = await admin
      .from("tournaments")
      .select("id, name, status")
      .eq("override_code", code)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!tournament) throw new Error("Invalid override code");

    // Verify the email is a captain in this tournament
    const { data: team, error: teamErr } = await admin
      .from("teams")
      .select("id, name")
      .eq("tournament_id", tournament.id)
      .ilike("captain_email", email)
      .maybeSingle();
    if (teamErr) throw new Error(teamErr.message);
    if (!team) throw new Error("Email is not registered as a captain for this tournament");

    // Generate a magic-link token the client can verify directly (no email required)
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
  });