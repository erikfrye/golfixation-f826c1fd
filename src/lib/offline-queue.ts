import { supabase } from "@/integrations/supabase/client";

export type HoleScorePayload = {
  team_id: string;
  tournament_id: string;
  hole_number: number;
  strokes: number;
  tee_shot_player_id: string | null;
  mulligan_player_id: string | null;
  last_edit_reason: string | null;
};

export type QueueItem = {
  id: string; // `${teamId}:${holeNumber}`
  teamId: string;
  holeNumber: number;
  payload: HoleScorePayload;
  queuedAt: number; // ms epoch
  attempts: number;
  lastError: string | null;
  status: "pending" | "failed";
  nextAttemptAt: number;
};

export type QueueSnapshot = {
  items: QueueItem[];
  syncing: boolean;
  online: boolean;
  lastSyncedAt: number | null;
};

type Listener = (snap: QueueSnapshot) => void;

const STORAGE_PREFIX = "golfixation:queue:";
const BACKOFFS = [2000, 5000, 15000, 30000];
const POLL_INTERVAL_MS = 20000;

function isBrowser() {
  return typeof window !== "undefined";
}

function storageKey(teamId: string) {
  return `${STORAGE_PREFIX}${teamId}`;
}

function loadItems(teamId: string): QueueItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(storageKey(teamId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueueItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveItems(teamId: string, items: QueueItem[]) {
  if (!isBrowser()) return;
  try {
    if (items.length === 0) localStorage.removeItem(storageKey(teamId));
    else localStorage.setItem(storageKey(teamId), JSON.stringify(items));
  } catch {
    // ignore quota/serialization errors
  }
}

class TeamQueue {
  private items: QueueItem[];
  private listeners = new Set<Listener>();
  private syncing = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastSyncedAt: number | null = null;

  constructor(public teamId: string) {
    this.items = loadItems(teamId);
    if (isBrowser()) {
      window.addEventListener("online", this.onOnline);
      window.addEventListener("focus", this.onFocus);
      document.addEventListener("visibilitychange", this.onVisibility);
      this.pollTimer = setInterval(() => {
        if (this.items.length > 0) void this.flush();
      }, POLL_INTERVAL_MS);
      // attempt initial flush if items exist
      if (this.items.length > 0) this.scheduleFlush(100);
    }
  }

  private onOnline = () => {
    this.notify();
    if (this.items.length > 0) this.scheduleFlush(0);
  };
  private onFocus = () => {
    if (this.items.length > 0) this.scheduleFlush(0);
  };
  private onVisibility = () => {
    if (document.visibilityState === "visible" && this.items.length > 0) {
      this.scheduleFlush(0);
    }
  };

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => {
      this.listeners.delete(fn);
    };
  }

  snapshot(): QueueSnapshot {
    return {
      items: [...this.items],
      syncing: this.syncing,
      online: isBrowser() ? navigator.onLine : true,
      lastSyncedAt: this.lastSyncedAt,
    };
  }

  private notify() {
    const snap = this.snapshot();
    this.listeners.forEach((l) => l(snap));
  }

  private persist() {
    saveItems(this.teamId, this.items);
  }

  enqueue(payload: HoleScorePayload): QueueItem {
    const id = `${payload.team_id}:${payload.hole_number}`;
    const existing = this.items.find((i) => i.id === id);
    const now = Date.now();
    const item: QueueItem = existing
      ? {
          ...existing,
          payload,
          queuedAt: existing.queuedAt, // keep original
          attempts: 0,
          lastError: null,
          status: "pending",
          nextAttemptAt: now,
        }
      : {
          id,
          teamId: payload.team_id,
          holeNumber: payload.hole_number,
          payload,
          queuedAt: now,
          attempts: 0,
          lastError: null,
          status: "pending",
          nextAttemptAt: now,
        };
    this.items = this.items.filter((i) => i.id !== id).concat(item);
    this.persist();
    this.notify();
    this.scheduleFlush(0);
    return item;
  }

  removeByHole(holeNumber: number) {
    const before = this.items.length;
    this.items = this.items.filter((i) => i.holeNumber !== holeNumber);
    if (this.items.length !== before) {
      this.persist();
      this.notify();
    }
  }

  retryAll() {
    const now = Date.now();
    let changed = false;
    this.items = this.items.map((i) => {
      if (i.status === "failed" || i.nextAttemptAt > now) {
        changed = true;
        return { ...i, status: "pending", nextAttemptAt: now, attempts: 0, lastError: null };
      }
      return i;
    });
    if (changed) this.persist();
    this.notify();
    this.scheduleFlush(0);
  }

  private scheduleFlush(delayMs: number) {
    if (!isBrowser()) return;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, delayMs);
  }

  private async flush() {
    if (this.syncing) return;
    if (this.items.length === 0) return;
    if (isBrowser() && !navigator.onLine) {
      this.notify();
      return;
    }
    // Need a session before attempting writes
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        this.notify();
        return;
      }
    } catch {
      return;
    }

    this.syncing = true;
    this.notify();

    const now = Date.now();
    const due = this.items.filter((i) => i.status === "pending" && i.nextAttemptAt <= now);
    let nextDelay: number | null = null;

    for (const item of due) {
      try {
        const { error } = await supabase
          .from("hole_scores")
          .upsert(item.payload, { onConflict: "team_id,hole_number" });
        if (error) throw error;
        // success — remove
        this.items = this.items.filter((i) => i.id !== item.id);
        this.lastSyncedAt = Date.now();
        this.persist();
        this.notify();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const attempts = item.attempts + 1;
        const backoff = BACKOFFS[Math.min(attempts - 1, BACKOFFS.length - 1)];
        this.items = this.items.map((i) =>
          i.id === item.id
            ? {
                ...i,
                attempts,
                lastError: message,
                nextAttemptAt: Date.now() + backoff,
                status: "pending",
              }
            : i,
        );
        this.persist();
        nextDelay = Math.min(nextDelay ?? backoff, backoff);
        this.notify();
      }
    }

    this.syncing = false;
    this.notify();

    if (this.items.length > 0) {
      const soonest = Math.max(
        500,
        Math.min(...this.items.map((i) => i.nextAttemptAt - Date.now())),
      );
      this.scheduleFlush(Number.isFinite(soonest) ? soonest : (nextDelay ?? 5000));
    }
  }
}

const queues = new Map<string, TeamQueue>();

export function getQueueForTeam(teamId: string): TeamQueue {
  let q = queues.get(teamId);
  if (!q) {
    q = new TeamQueue(teamId);
    queues.set(teamId, q);
  }
  return q;
}