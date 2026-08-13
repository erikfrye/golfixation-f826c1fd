import { describe, it, expect } from "vitest";
import { tierForScore } from "../score-celebration";

describe("tierForScore", () => {
  it("returns 'par' for par", () => {
    expect(tierForScore(4, 4)).toBe("par");
    expect(tierForScore(3, 3)).toBe("par");
  });

  it("returns 'ace' for hole-in-one on a par > 1", () => {
    expect(tierForScore(1, 3)).toBe("ace");
    expect(tierForScore(1, 4)).toBe("ace");
    expect(tierForScore(1, 5)).toBe("ace");
  });

  it("returns 'albatross' for 3+ under par", () => {
    expect(tierForScore(2, 5)).toBe("albatross");
    expect(tierForScore(1, 5)).toBe("ace"); // ace beats albatross on par-4+
  });

  it("returns 'eagle' for 2 under par", () => {
    expect(tierForScore(3, 5)).toBe("eagle");
    expect(tierForScore(2, 4)).toBe("eagle");
  });

  it("returns 'birdie' for 1 under par", () => {
    expect(tierForScore(3, 4)).toBe("birdie");
    expect(tierForScore(4, 5)).toBe("birdie");
  });

  it("returns bogey tiers for over par", () => {
    expect(tierForScore(5, 4)).toBe("bogey");
    expect(tierForScore(6, 4)).toBe("double-bogey");
    expect(tierForScore(8, 4)).toBe("over");
  });

  it("returns null for invalid input", () => {
    expect(tierForScore(0, 4)).toBeNull();
    expect(tierForScore(4, 0)).toBeNull();
    expect(tierForScore(NaN, 4)).toBeNull();
  });
});
