import { describe, it, expect } from "vitest";
import {
  buildScorecard,
  proximityWinners,
  toCsv,
  exportFileBase,
  type ExportPayload,
} from "../export-scorecard";

function payload(overrides: Partial<ExportPayload> = {}): ExportPayload {
  return {
    tournament: {
      id: "t1",
      name: "Chamber of Commerce",
      location: "Knox CC",
      start_date: "2026-09-10T14:00:00.000Z",
      format: "texas_scramble",
      num_holes: 18,
      status: "completed",
    },
    holes: Array.from({ length: 18 }, (_, i) => ({ hole_number: i + 1, par: 4 })),
    teams: [
      { id: "a", name: "Kerstings" },
      { id: "b", name: "A-1 Trucking" },
      { id: "c", name: "No Shows" },
    ],
    players: [
      { team_id: "a", name: "Pat" },
      { team_id: "b", name: "Sam" },
    ],
    scores: [
      ...Array.from({ length: 18 }, (_, i) => ({
        team_id: "a",
        hole_number: i + 1,
        strokes: 4,
      })),
      ...Array.from({ length: 18 }, (_, i) => ({
        team_id: "b",
        hole_number: i + 1,
        strokes: 3,
      })),
    ],
    contests: [
      {
        id: "c1",
        hole_number: 7,
        name: "Closest to pin",
        kind: "closest_to_pin",
        eligibility: "everyone",
        sponsor: null,
        sort_order: 0,
      },
    ],
    entries: [
      {
        contest_id: "c1",
        player_name_snapshot: "Sam",
        team_name_snapshot: "A-1 Trucking",
        note: "3 ft",
        entered_at: "2026-09-10T16:00:00.000Z",
      },
      {
        contest_id: "c1",
        player_name_snapshot: "Pat",
        team_name_snapshot: "Kerstings",
        note: null,
        entered_at: "2026-09-10T15:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

describe("buildScorecard", () => {
  it("totals OUT, IN and gross and sorts by gross", () => {
    const card = buildScorecard(payload());
    expect(card.hasBackNine).toBe(true);
    expect(card.totalPar).toBe(72);
    expect(card.rows[0].name).toBe("A-1 Trucking");
    expect(card.rows[0].out).toBe(27);
    expect(card.rows[0].in).toBe(27);
    expect(card.rows[0].gross).toBe(54);
    expect(card.rows[1].gross).toBe(72);
  });

  it("puts teams with no scores last and leaves holes blank", () => {
    const card = buildScorecard(payload());
    const last = card.rows[card.rows.length - 1];
    expect(last.name).toBe("No Shows");
    expect(last.holesPlayed).toBe(0);
    expect(last.strokes.every((s) => s === null)).toBe(true);
  });

  it("omits the back nine for a 9-hole tournament", () => {
    const p = payload();
    p.tournament.num_holes = 9;
    const card = buildScorecard(p);
    expect(card.hasBackNine).toBe(false);
    expect(card.holeNumbers).toHaveLength(9);
    expect(card.rows[0].in).toBeNull();
  });
});

describe("proximityWinners", () => {
  it("takes the first pre-sorted entry per contest", () => {
    const [w] = proximityWinners(payload());
    expect(w.player).toBe("Sam");
    expect(w.team).toBe("A-1 Trucking");
  });

  it("returns a null winner when nobody entered", () => {
    const [w] = proximityWinners(payload({ entries: [] }));
    expect(w.player).toBeNull();
  });
});

describe("toCsv", () => {
  it("includes header, grid, rosters and contests", () => {
    const csv = toCsv(payload());
    expect(csv).toContain("Golfixation");
    expect(csv).toContain("Team,1,2,3,4,5,6,7,8,9,OUT");
    expect(csv).toContain("GROSS");
    expect(csv).toContain("Team rosters");
    expect(csv).toContain("Proximity contests");
    expect(csv).toContain("Closest to pin");
  });

  it("quotes cells containing commas", () => {
    const p = payload();
    p.teams = [{ id: "a", name: "Smith, Jones & Co" }];
    expect(toCsv(p)).toContain('"Smith, Jones & Co"');
  });
});

describe("exportFileBase", () => {
  it("slugifies the name and appends the date", () => {
    expect(
      exportFileBase({ name: "Chamber of Commerce!", start_date: "2026-09-10T14:00:00.000Z" }),
    ).toBe("golfixation-chamber-of-commerce-2026-09-10");
  });
});
