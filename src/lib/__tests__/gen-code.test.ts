import { describe, it, expect } from "vitest";
import { genCode } from "@/lib/admin.functions";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

describe("genCode", () => {
  it("defaults to length 6", () => {
    expect(genCode()).toHaveLength(6);
  });

  it("honors custom length", () => {
    expect(genCode(10)).toHaveLength(10);
    expect(genCode(1)).toHaveLength(1);
  });

  it("only emits characters from the allowed alphabet (no I/O/0/1)", () => {
    for (let i = 0; i < 500; i++) {
      const c = genCode(8);
      for (const ch of c) {
        expect(ALPHABET.includes(ch)).toBe(true);
      }
    }
  });

  it("produces varied output (low collision rate at 1000 samples)", () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) set.add(genCode());
    // 32^6 ≈ 1B possibilities; collisions in 1k samples should be essentially zero
    expect(set.size).toBeGreaterThan(995);
  });
});