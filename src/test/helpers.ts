import { vi } from "vitest";

type Result = { data: unknown; error: unknown };
type Resolver = Result | ((args: { table: string; calls: Call[] }) => Result);
type Call = { method: string; args: unknown[] };

/**
 * Chainable mock for a Supabase admin client. Each `.from(table)` returns a
 * fresh chain that records every call and resolves with the next queued result
 * when awaited or after a terminal method (`maybeSingle`, `single`).
 *
 * Usage:
 *   const admin = mockSupabaseAdmin();
 *   admin.queue("tournaments", { data: [{ id: "x" }], error: null });
 *   await myHandler({ admin, ... });
 *   expect(admin.calls("tournaments")[0].method).toBe("select");
 */
export function mockSupabaseAdmin() {
  const queues = new Map<string, Resolver[]>();
  const callLog = new Map<string, Call[]>();

  function nextResult(table: string): Result {
    const q = queues.get(table) ?? [];
    const r = q.shift();
    if (!r) return { data: null, error: null };
    return typeof r === "function" ? r({ table, calls: callLog.get(table) ?? [] }) : r;
  }

  function chain(table: string) {
    const calls: Call[] = callLog.get(table) ?? [];
    callLog.set(table, calls);
    const handler = {
      get(_t: object, prop: string) {
        if (prop === "then") {
          // Awaiting the chain triggers resolution.
          const result = nextResult(table);
          return (resolve: (v: Result) => unknown) => resolve(result);
        }
        return (...args: unknown[]) => {
          calls.push({ method: prop, args });
          if (prop === "maybeSingle" || prop === "single") {
            return Promise.resolve(nextResult(table));
          }
          return proxy;
        };
      },
    } as ProxyHandler<object>;
    const proxy: any = new Proxy({}, handler);
    return proxy;
  }

  const generateLink = vi.fn(async () => ({
    data: { properties: { hashed_token: "tok_test" } },
    error: null,
  }));

  const admin = {
    from: vi.fn((table: string) => chain(table)),
    auth: { admin: { generateLink } },
    queue(table: string, ...results: Resolver[]) {
      const q = queues.get(table) ?? [];
      q.push(...results);
      queues.set(table, q);
    },
    calls(table: string): Call[] {
      return callLog.get(table) ?? [];
    },
    _generateLink: generateLink,
  };
  return admin;
}

export type MockAdmin = ReturnType<typeof mockSupabaseAdmin>;