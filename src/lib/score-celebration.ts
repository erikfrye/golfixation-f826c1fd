export type CelebrationTier = "ace" | "albatross" | "eagle" | "birdie" | "oof";

/**
 * Map a (strokes, par) pair to a celebration tier.
 * Returns null when no celebration should fire (e.g. par, or invalid input).
 *
 * - strokes === 1                 -> "ace"        (hole-in-one trumps tier)
 * - strokes - par <= -3           -> "albatross"
 * - strokes - par === -2          -> "eagle"
 * - strokes - par === -1          -> "birdie"
 * - strokes - par >=  1           -> "oof"        (bogey or worse)
 * - strokes === par               -> null
 */
export function tierForScore(strokes: number, par: number): CelebrationTier | null {
  if (!Number.isFinite(strokes) || !Number.isFinite(par)) return null;
  if (strokes < 1 || par < 1) return null;
  if (strokes === 1 && par > 1) return "ace";
  const diff = strokes - par;
  if (diff <= -3) return "albatross";
  if (diff === -2) return "eagle";
  if (diff === -1) return "birdie";
  if (diff >= 1) return "oof";
  return null;
}

export const TIER_LABEL: Record<CelebrationTier, string> = {
  ace: "ACE!",
  albatross: "ALBATROSS",
  eagle: "EAGLE",
  birdie: "BIRDIE",
  oof: "OOF",
};