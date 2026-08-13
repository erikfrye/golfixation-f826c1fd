export type CelebrationTier =
  | "ace"
  | "albatross"
  | "eagle"
  | "birdie"
  | "par"
  | "bogey"
  | "double-bogey"
  | "over";

/**
 * Map a (strokes, par) pair to a celebration tier.
 * Returns null only for invalid input.
 */
export function tierForScore(strokes: number, par: number): CelebrationTier | null {
  if (!Number.isFinite(strokes) || !Number.isFinite(par)) return null;
  if (strokes < 1 || par < 1) return null;
  if (strokes === 1 && par > 1) return "ace";
  const diff = strokes - par;
  if (diff <= -3) return "albatross";
  if (diff === -2) return "eagle";
  if (diff === -1) return "birdie";
  if (diff === 0) return "par";
  if (diff === 1) return "bogey";
  if (diff === 2) return "double-bogey";
  return "over";
}

export const TIER_LABEL: Record<CelebrationTier, string> = {
  ace: "Hole-In-One!",
  albatross: "Albatross",
  eagle: "Eagle",
  birdie: "Birdie",
  par: "Par",
  bogey: "Bogey",
  "double-bogey": "Double Bogey",
  over: "Ouch",
};
