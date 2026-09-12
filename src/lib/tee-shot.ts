export type TeeShotFlagScore = {
  hole_number: number;
  tee_shot_player_id: string | null;
  tee_shot_override?: boolean | null;
};

export type TeeShotFlagInput = {
  format: string;
  teeShotMinimum: number;
  numHoles: number;
  playerIds: string[];
  scores: TeeShotFlagScore[];
};

/** Number of tee shots still owed across all players. */
export function teeShotShortfall({ teeShotMinimum, playerIds, scores }: Omit<TeeShotFlagInput, "format" | "numHoles">) {
  const used = new Map<string, number>();
  scores.forEach((s) => {
    if (s.tee_shot_player_id) used.set(s.tee_shot_player_id, (used.get(s.tee_shot_player_id) ?? 0) + 1);
  });
  return playerIds.reduce((sum, id) => sum + Math.max(0, teeShotMinimum - (used.get(id) ?? 0)), 0);
}

/**
 * A team is flagged when a captain acknowledged saving a hole that broke the
 * tee-shot minimum AND the current data still makes the minimum unreachable.
 * Correcting earlier holes clears the flag automatically.
 */
export function isTeeShotMinimumFlagged(input: TeeShotFlagInput): boolean {
  if (input.format !== "texas_scramble") return false;
  if (input.teeShotMinimum <= 0) return false;
  if (!input.scores.some((s) => s.tee_shot_override)) return false;
  const shortfall = teeShotShortfall(input);
  if (shortfall === 0) return false;
  const holesRemaining = Math.max(0, input.numHoles - input.scores.length);
  return shortfall > holesRemaining;
}
