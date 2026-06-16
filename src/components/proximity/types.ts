export type ProximityKind = "longest_drive" | "closest_to_pin" | "longest_putt" | "other";
export type ProximityEligibility = "everyone" | "men" | "women";

export type ProximityContest = {
  id: string;
  tournament_id: string;
  hole_number: number;
  name: string;
  kind: ProximityKind;
  eligibility: ProximityEligibility;
  sponsor: string | null;
  sort_order: number;
};

export type ProximityEntry = {
  id: string;
  contest_id: string;
  team_id: string;
  player_id: string | null;
  player_name_snapshot: string;
  team_name_snapshot: string;
  note: string | null;
  entered_at: string;
  round_position: number;
};

export const KIND_LABEL: Record<ProximityKind, string> = {
  longest_drive: "Longest Drive",
  closest_to_pin: "Closest to the Pin",
  longest_putt: "Longest Putt",
  other: "Other",
};

export const ELIGIBILITY_LABEL: Record<ProximityEligibility, string> = {
  everyone: "Everyone",
  men: "Men",
  women: "Women",
};