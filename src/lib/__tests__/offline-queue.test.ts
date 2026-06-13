import { describe, it, expect, beforeEach, vi } from "vitest";
import { setOnline } from "@/test/setup";

// Mock the supabase client used inside offline-queue.
const upsert = vi.fn();
const getSession = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (_table: string) => ({ upsert: (...args: unknown[]) => upsert(...args) }),
    auth: { getSession: () => getSession() },
  },
}));

import { getQueueForTeam, type HoleScorePayload } from "@/lib/offline-queue";

function payload(overrides: Partial<HoleScorePayload> = {}): HoleScorePayload {
  return {
    team_id: "team-A",
    tournament_id: "tour-A",
    hole_number: 1,
    strokes: 4,
    tee_shot_player_id: null,
    mulligan_player_id: null,
    last_edit_reason: null,
    ...overrides,
  };
}

async function flushMicro() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

let teamCounter = 0;
function freshTeamId() {
  teamCounter++;
  return `team-${teamCounter}-${Math.random().toString(36).slice(2)}`;
}

beforeEach(() => {
  upsert.mockReset();
  getSession.mockReset();
  getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
  upsert.mockResolvedValue({ error: null });
  setOnline(true);
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

describe("offline-queue: enqueue / dedupe / remove", () => {
  it("enqueue creates a pending item and persists to localStorage", async () => {
    const teamId = freshTeamId();
    const q = getQueueForTeam(teamId);
    const p = payload({ team_id: teamId });
    q.enqueue(p);
    const snap = q.snapshot();
    expect(snap.items).toHaveLength(1);
    expect(snap.items[0]).toMatchObject({
      status: "pending",
      attempts: 0,
      holeNumber: 1,
    });
    expect(localStorage.getItem(`golfixation:queue:${teamId}`)).not.toBeNull();
  });

  it("dedupes same team/hole, resets attempts, keeps original queuedAt", async () => {
    const teamId = freshTeamId();
    const q = getQueueForTeam(teamId);
    upsert.mockResolvedValueOnce({ error: { message: "x" } });
    q.enqueue(payload({ team_id: teamId, strokes: 4 }));
    await flushMicro();
    await vi.advanceTimersByTimeAsync(50);
    const before = q.snapshot().items[0];
    expect(before.attempts).toBeGreaterThanOrEqual(1);
    const originalQueuedAt = before.queuedAt;

    q.enqueue(payload({ team_id: teamId, strokes: 5 }));
    const after = q.snapshot().items[0];
    expect(after.payload.strokes).toBe(5);
    expect(after.attempts).toBe(0);
    expect(after.queuedAt).toBe(originalQueuedAt);
  });

  it("removeByHole removes matching items", () => {
    const teamId = freshTeamId();
    const q = getQueueForTeam(teamId);
    q.enqueue(payload({ team_id: teamId, hole_number: 1 }));
    q.enqueue(payload({ team_id: teamId, hole_number: 2 }));
    expect(q.snapshot().items).toHaveLength(2);
    q.removeByHole(1);
    expect(q.snapshot().items.map((i) => i.holeNumber)).toEqual([2]);
  });
});

describe("offline-queue: flush", () => {
  it("flushes successfully when online + session present", async () => {
    const teamId = freshTeamId();
    const q = getQueueForTeam(teamId);
    q.enqueue(payload({ team_id: teamId }));
    await vi.advanceTimersByTimeAsync(200);
    await flushMicro();
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(q.snapshot().items).toHaveLength(0);
    expect(q.snapshot().lastSyncedAt).not.toBeNull();
  });

  it("does not upsert when offline", async () => {
    setOnline(false);
    const teamId = freshTeamId();
    const q = getQueueForTeam(teamId);
    q.enqueue(payload({ team_id: teamId }));
    await vi.advanceTimersByTimeAsync(200);
    await flushMicro();
    expect(upsert).not.toHaveBeenCalled();
    expect(q.snapshot().items).toHaveLength(1);
  });

  it("does not upsert when no session", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    const teamId = freshTeamId();
    const q = getQueueForTeam(teamId);
    q.enqueue(payload({ team_id: teamId }));
    await vi.advanceTimersByTimeAsync(200);
    await flushMicro();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("retries with backoff on failure", async () => {
    upsert.mockResolvedValue({ error: { message: "boom" } });
    const teamId = freshTeamId();
    const q = getQueueForTeam(teamId);
    q.enqueue(payload({ team_id: teamId }));
    await vi.advanceTimersByTimeAsync(200);
    await flushMicro();
    const item = q.snapshot().items[0];
    expect(item.attempts).toBe(1);
    expect(item.lastError).toBeTruthy();
    // next attempt scheduled ~2s out per BACKOFFS[0]
    expect(item.nextAttemptAt - Date.now()).toBeGreaterThan(1000);
  });
});

describe("offline-queue: retryAll / subscribe", () => {
  it("retryAll resets attempts/status to pending immediately", async () => {
    upsert.mockResolvedValueOnce({ error: { message: "x" } });
    const teamId = freshTeamId();
    const q = getQueueForTeam(teamId);
    q.enqueue(payload({ team_id: teamId }));
    await vi.advanceTimersByTimeAsync(200);
    await flushMicro();
    const before = q.snapshot().items[0];
    expect(before.attempts).toBe(1);

    upsert.mockResolvedValueOnce({ error: null });
    q.retryAll();
    const after = q.snapshot().items[0];
    if (after) {
      expect(after.attempts).toBe(0);
      expect(after.status).toBe("pending");
    }
  });

  it("subscribers receive notifications on enqueue", () => {
    const teamId = freshTeamId();
    const q = getQueueForTeam(teamId);
    const seen: number[] = [];
    const unsub = q.subscribe((snap) => seen.push(snap.items.length));
    q.enqueue(payload({ team_id: teamId }));
    expect(seen.length).toBeGreaterThan(0);
    unsub();
  });
});