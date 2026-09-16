/** Pure helpers for building tournament score exports (scorecard grid + CSV). */

export type ExportTournament = {
  id: string;
  name: string;
  location: string | null;
  start_date: string | null;
  format: string;
  num_holes: number;
  status: string;
};

export type ExportHole = { hole_number: number; par: number };
export type ExportTeam = { id: string; name: string };
export type ExportPlayer = { team_id: string; name: string };
export type ExportScore = { team_id: string; hole_number: number; strokes: number };
export type ExportContest = {
  id: string;
  hole_number: number;
  name: string;
  kind: string;
  eligibility: string;
  sponsor: string | null;
  sort_order: number;
};
export type ExportEntry = {
  contest_id: string;
  player_name_snapshot: string;
  team_name_snapshot: string;
  note: string | null;
  entered_at: string;
};

export type ExportPayload = {
  tournament: ExportTournament;
  holes: ExportHole[];
  teams: ExportTeam[];
  players: ExportPlayer[];
  scores: ExportScore[];
  contests: ExportContest[];
  /** Pre-sorted: round_position desc, entered_at desc (leader first per contest). */
  entries: ExportEntry[];
};

export type ScoreRow = {
  teamId: string;
  name: string;
  strokes: (number | null)[];
  out: number | null;
  in: number | null;
  gross: number;
  holesPlayed: number;
};

export type Scorecard = {
  holeNumbers: number[];
  pars: number[];
  hasBackNine: boolean;
  outPar: number;
  inPar: number;
  totalPar: number;
  rows: ScoreRow[];
};

export type ScoreMark = "eagle" | "birdie" | "par" | "bogey" | "double-bogey" | "over";

/** Traditional paper-scorecard mark for a played hole. */
export function scoreMark(strokes: number | null, par: number): ScoreMark | null {
  if (strokes == null || strokes < 1 || par < 1) return null;
  const difference = strokes - par;
  if (difference <= -2) return "eagle";
  if (difference === -1) return "birdie";
  if (difference === 0) return "par";
  if (difference === 1) return "bogey";
  if (difference === 2) return "double-bogey";
  return "over";
}

function sum(values: (number | null)[]): number | null {
  const played = values.filter((v): v is number => v != null);
  return played.length === 0 ? null : played.reduce((a, b) => a + b, 0);
}

export function buildScorecard(payload: ExportPayload): Scorecard {
  const holeNumbers = Array.from(
    { length: payload.tournament.num_holes },
    (_, i) => i + 1,
  );
  const parByHole = new Map(payload.holes.map((h) => [h.hole_number, h.par]));
  const pars = holeNumbers.map((n) => parByHole.get(n) ?? 4);
  const hasBackNine = holeNumbers.length > 9;

  const scoreKey = (teamId: string, hole: number) => `${teamId}:${hole}`;
  const byKey = new Map(
    payload.scores.map((s) => [scoreKey(s.team_id, s.hole_number), s.strokes]),
  );

  const rows: ScoreRow[] = payload.teams.map((t) => {
    const strokes = holeNumbers.map((n) => byKey.get(scoreKey(t.id, n)) ?? null);
    const front = strokes.slice(0, 9);
    const back = hasBackNine ? strokes.slice(9) : [];
    const played = strokes.filter((v): v is number => v != null);
    return {
      teamId: t.id,
      name: t.name,
      strokes,
      out: sum(front),
      in: hasBackNine ? sum(back) : null,
      gross: played.reduce((a, b) => a + b, 0),
      holesPlayed: played.length,
    };
  });

  rows.sort((a, b) => {
    if (a.holesPlayed === 0 && b.holesPlayed === 0) return a.name.localeCompare(b.name);
    if (a.holesPlayed === 0) return 1;
    if (b.holesPlayed === 0) return -1;
    if (a.gross !== b.gross) return a.gross - b.gross;
    return a.name.localeCompare(b.name);
  });

  return {
    holeNumbers,
    pars,
    hasBackNine,
    outPar: pars.slice(0, 9).reduce((a, b) => a + b, 0),
    inPar: hasBackNine ? pars.slice(9).reduce((a, b) => a + b, 0) : 0,
    totalPar: pars.reduce((a, b) => a + b, 0),
    rows,
  };
}

export type ProximityWinner = {
  contestId: string;
  holeNumber: number;
  contestName: string;
  eligibility: string;
  sponsor: string | null;
  player: string | null;
  team: string | null;
  note: string | null;
};

export function proximityWinners(payload: ExportPayload): ProximityWinner[] {
  const contests = [...payload.contests].sort(
    (a, b) => a.hole_number - b.hole_number || a.sort_order - b.sort_order,
  );
  return contests.map((c) => {
    const winner = payload.entries.find((e) => e.contest_id === c.id);
    return {
      contestId: c.id,
      holeNumber: c.hole_number,
      contestName: c.name,
      eligibility: c.eligibility,
      sponsor: c.sponsor,
      player: winner?.player_name_snapshot ?? null,
      team: winner?.team_name_snapshot ?? null,
      note: winner?.note ?? null,
    };
  });
}

function csvCell(value: string | number | null | undefined): string {
  if (value == null || value === "") return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvCell).join(",");
}

export function toCsv(payload: ExportPayload): string {
  const card = buildScorecard(payload);
  const t = payload.tournament;
  const lines: string[] = [];

  lines.push(csvRow(["Golfixation — Tournament scores"]));
  lines.push(csvRow(["Tournament", t.name]));
  lines.push(csvRow(["Course", t.location ?? ""]));
  lines.push(
    csvRow(["Date", t.start_date ? new Date(t.start_date).toLocaleString() : ""]),
  );
  lines.push(csvRow(["Format", t.format.replace(/_/g, " ")]));
  lines.push(csvRow(["Holes", t.num_holes]));
  lines.push("");

  const front = card.holeNumbers.slice(0, 9);
  const back = card.hasBackNine ? card.holeNumbers.slice(9) : [];
  const header = [
    "Team",
    ...front.map(String),
    "OUT",
    ...(card.hasBackNine ? [...back.map(String), "IN"] : []),
    "GROSS",
  ];
  lines.push(csvRow(header));
  lines.push(
    csvRow([
      "Par",
      ...card.pars.slice(0, 9),
      card.outPar,
      ...(card.hasBackNine ? [...card.pars.slice(9), card.inPar] : []),
      card.totalPar,
    ]),
  );
  for (const r of card.rows) {
    lines.push(
      csvRow([
        r.name,
        ...r.strokes.slice(0, 9),
        r.out,
        ...(card.hasBackNine ? [...r.strokes.slice(9), r.in] : []),
        r.holesPlayed > 0 ? r.gross : null,
      ]),
    );
  }

  lines.push("");
  lines.push(csvRow(["Team rosters"]));
  lines.push(csvRow(["Team", "Player"]));
  for (const team of payload.teams) {
    const roster = payload.players.filter((p) => p.team_id === team.id);
    if (roster.length === 0) lines.push(csvRow([team.name, ""]));
    for (const p of roster) lines.push(csvRow([team.name, p.name]));
  }

  const winners = proximityWinners(payload);
  if (winners.length > 0) {
    lines.push("");
    lines.push(csvRow(["Proximity contests"]));
    lines.push(csvRow(["Hole", "Contest", "Eligibility", "Winner", "Team", "Note"]));
    for (const w of winners) {
      lines.push(
        csvRow([
          w.holeNumber,
          w.contestName,
          w.eligibility,
          w.player ?? "—",
          w.team ?? "",
          w.note ?? "",
        ]),
      );
    }
  }

  return lines.join("\r\n");
}

export function exportFileBase(t: { name: string; start_date: string | null }): string {
  const slug = t.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const date = (t.start_date ? new Date(t.start_date) : new Date())
    .toISOString()
    .slice(0, 10);
  return `golfixation-${slug || "tournament"}-${date}`;
}
