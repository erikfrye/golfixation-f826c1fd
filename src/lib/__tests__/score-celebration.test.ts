import { describe, it, expect } from "vitest";
import { tierForScore } from "../score-celebration";

describe("tierForScore", () => {
  it("returns null for par", () => {
    expect(tierForScore(4, 4)).toBeNull();
    expect(tierForScore(3, 3)).toBeNull();
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

  it("returns 'oof' for bogey or worse", () => {
    expect(tierForScore(5, 4)).toBe("oof");
    expect(tierForScore(8, 4)).toBe("oof");
  });

  it("returns null for invalid input", () => {
    expect(tierForScore(0, 4)).toBeNull();
    expect(tierForScore(4, 0)).toBeNull();
    expect(tierForScore(NaN, 4)).toBeNull();
  });
});