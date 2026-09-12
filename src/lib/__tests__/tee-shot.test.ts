import { describe, expect, it } from "vitest";
import { isTeeShotMinimumFlagged, teeShotShortfall } from "@/lib/tee-shot";

const players = ["a", "b", "c", "d"];

function score(hole: number, tee: string | null, override = false) {
  return { hole_number: hole, tee_shot_player_id: tee, tee_shot_override: override };
}

describe("teeShotShortfall", () => {
  it("counts remaining required tee shots", () => {
    expect(
      teeShotShortfall({ teeShotMinimum: 2, playerIds: players, scores: [score(1, "a"), score(2, "a")] }),
    ).toBe(6);
  });
});

describe("isTeeShotMinimumFlagged", () => {
  const base = { format: "texas_scramble", teeShotMinimum: 1, numHoles: 4, playerIds: players };

  it("is false without an acknowledged override", () => {
    expect(isTeeShotMinimumFlagged({ ...base, scores: [score(1, "a"), score(2, "a")] })).toBe(false);
  });

  it("is true when the minimum can no longer be met", () => {
    const scores = [score(1, "a"), score(2, "a", true), score(3, "b"), score(4, "c")];
    expect(isTeeShotMinimumFlagged({ ...base, scores })).toBe(true);
  });

  it("clears once the tee shots are corrected", () => {
    const scores = [score(1, "a"), score(2, "d", true), score(3, "b"), score(4, "c")];
    expect(isTeeShotMinimumFlagged({ ...base, scores })).toBe(false);
  });

  it("ignores non-scramble formats", () => {
    const scores = [score(1, "a", true)];
    expect(isTeeShotMinimumFlagged({ ...base, format: "scramble", scores })).toBe(false);
  });
});
