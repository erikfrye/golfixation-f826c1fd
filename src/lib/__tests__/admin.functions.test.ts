import { describe, it, expect } from "vitest";
import { mockSupabaseAdmin } from "@/test/helpers";
import {
  assertAdmin,
  adminListTournamentsHandler,
  adminGetTournamentHandler,
  adminListTeamsHandler,
  listMyCaptainTeamsHandler,
  adminGetScoreAuditHandler,
  adminCloneTournamentHandler,
} from "@/lib/admin.functions";

const ADMIN_UUID = "00000000-0000-0000-0000-000000000001";
const T_UUID = "11111111-1111-1111-1111-111111111111";

function queueAdminCheck(admin: ReturnType<typeof mockSupabaseAdmin>, ok = true) {
  admin.queue("admins", { data: ok ? { id: ADMIN_UUID } : null, error: null });
}

describe("assertAdmin", () => {
  it("throws when no admin row", async () => {
    const admin = mockSupabaseAdmin();
    queueAdminCheck(admin, false);
    await expect(assertAdmin(ADMIN_UUID, admin as any)).rejects.toThrow(/Forbidden/);
  });

  it("returns the admin client when row exists", async () => {
    const admin = mockSupabaseAdmin();
    queueAdminCheck(admin, true);
    await expect(assertAdmin(ADMIN_UUID, admin as any)).resolves.toBe(admin);
  });

  it("surfaces query errors", async () => {
    const admin = mockSupabaseAdmin();
    admin.queue("admins", { data: null, error: { message: "boom" } });
    await expect(assertAdmin(ADMIN_UUID, admin as any)).rejects.toThrow("boom");
  });
});

describe("adminListTournamentsHandler", () => {
  it("rejects non-admins", async () => {
    const admin = mockSupabaseAdmin();
    queueAdminCheck(admin, false);
    await expect(adminListTournamentsHandler(admin as any, ADMIN_UUID)).rejects.toThrow(/Forbidden/);
  });

  it("returns rows on success", async () => {
    const admin = mockSupabaseAdmin();
    queueAdminCheck(admin, true);
    admin.queue("tournaments", { data: [{ id: "a" }, { id: "b" }], error: null });
    const rows = await adminListTournamentsHandler(admin as any, ADMIN_UUID);
    expect(rows).toEqual([{ id: "a" }, { id: "b" }]);
  });

  it("surfaces query error", async () => {
    const admin = mockSupabaseAdmin();
    queueAdminCheck(admin, true);
    admin.queue("tournaments", { data: null, error: { message: "db down" } });
    await expect(adminListTournamentsHandler(admin as any, ADMIN_UUID)).rejects.toThrow("db down");
  });
});

describe("adminGetTournamentHandler", () => {
  it("returns the row", async () => {
    const admin = mockSupabaseAdmin();
    queueAdminCheck(admin, true);
    admin.queue("tournaments", { data: { id: T_UUID, name: "Cup" }, error: null });
    const row = await adminGetTournamentHandler(admin as any, ADMIN_UUID, { id: T_UUID });
    expect(row).toEqual({ id: T_UUID, name: "Cup" });
  });
});

describe("adminListTeamsHandler", () => {
  it("returns rows", async () => {
    const admin = mockSupabaseAdmin();
    queueAdminCheck(admin, true);
    admin.queue("teams", { data: [{ id: "t1" }], error: null });
    const rows = await adminListTeamsHandler(admin as any, ADMIN_UUID, { tournamentId: T_UUID });
    expect(rows).toEqual([{ id: "t1" }]);
  });
});

describe("listMyCaptainTeamsHandler", () => {
  it("returns [] when no email claim", async () => {
    const admin = mockSupabaseAdmin();
    const rows = await listMyCaptainTeamsHandler(admin as any, undefined);
    expect(rows).toEqual([]);
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("queries with lowercased email", async () => {
    const admin = mockSupabaseAdmin();
    admin.queue("teams", { data: [{ id: "t1" }], error: null });
    const rows = await listMyCaptainTeamsHandler(admin as any, "Foo@BAR.com");
    expect(rows).toEqual([{ id: "t1" }]);
    const ilike = admin.calls("teams").find((c) => c.method === "ilike");
    expect(ilike?.args).toEqual(["captain_email", "foo@bar.com"]);
  });

  it("bubbles errors", async () => {
    const admin = mockSupabaseAdmin();
    admin.queue("teams", { data: null, error: { message: "nope" } });
    await expect(listMyCaptainTeamsHandler(admin as any, "a@b.co")).rejects.toThrow("nope");
  });
});

describe("adminGetScoreAuditHandler", () => {
  it("returns shaped result", async () => {
    const admin = mockSupabaseAdmin();
    queueAdminCheck(admin, true);
    admin.queue("hole_score_audit", { data: [{ id: "a1" }], error: null });
    admin.queue("teams", { data: [{ id: "t1", name: "X" }], error: null });
    admin.queue("team_players", { data: [{ id: "p1", name: "Y" }], error: null });
    const res = await adminGetScoreAuditHandler(admin as any, ADMIN_UUID, { tournamentId: T_UUID });
    expect(res).toEqual({
      entries: [{ id: "a1" }],
      teams: [{ id: "t1", name: "X" }],
      players: [{ id: "p1", name: "Y" }],
    });
  });

  it("throws on any sub-query error", async () => {
    const admin = mockSupabaseAdmin();
    queueAdminCheck(admin, true);
    admin.queue("hole_score_audit", { data: [], error: null });
    admin.queue("teams", { data: null, error: { message: "teams fail" } });
    admin.queue("team_players", { data: [], error: null });
    await expect(
      adminGetScoreAuditHandler(admin as any, ADMIN_UUID, { tournamentId: T_UUID }),
    ).rejects.toThrow("teams fail");
  });
});

describe("adminCloneTournamentHandler", () => {
  const input = { id: T_UUID, name: "Clone" };

  it("throws when source missing", async () => {
    const admin = mockSupabaseAdmin();
    queueAdminCheck(admin, true);
    admin.queue("tournaments", { data: null, error: null });
    await expect(adminCloneTournamentHandler(admin as any, ADMIN_UUID, input)).rejects.toThrow(
      /Source tournament not found/,
    );
  });

  it("clones settings and copies holes", async () => {
    const admin = mockSupabaseAdmin();
    queueAdminCheck(admin, true);
    admin.queue("tournaments", {
      data: {
        num_holes: 18,
        format: "stroke",
        tee_shot_minimum: 2,
        about_content: "hi",
        mulligans_enabled: true,
        start_format: "tee_time",
      },
      error: null,
    });
    admin.queue("holes", {
      data: [
        { hole_number: 1, par: 4, handicap: 9 },
        { hole_number: 2, par: 3, handicap: 17 },
      ],
      error: null,
    });
    // insert -> .select("id").single()
    admin.queue("tournaments", { data: { id: "new-id" }, error: null });
    admin.queue("holes", { data: null, error: null });

    const res = await adminCloneTournamentHandler(admin as any, ADMIN_UUID, input);
    expect(res).toEqual({ id: "new-id" });

    const tCalls = admin.calls("tournaments");
    const insert = tCalls.find((c) => c.method === "insert");
    expect(insert).toBeDefined();
    const inserted = insert!.args[0] as Record<string, unknown>;
    expect(inserted).toMatchObject({
      name: "Clone",
      status: "draft",
      num_holes: 18,
      created_by: ADMIN_UUID,
    });
    expect(typeof inserted.override_code).toBe("string");
    expect((inserted.override_code as string).length).toBe(6);

    const hCalls = admin.calls("holes");
    const holeInsert = hCalls.find((c) => c.method === "insert");
    expect(holeInsert).toBeDefined();
    expect(holeInsert!.args[0]).toEqual([
      { tournament_id: "new-id", hole_number: 1, par: 4, handicap: 9 },
      { tournament_id: "new-id", hole_number: 2, par: 3, handicap: 17 },
    ]);
  });

  it("skips hole insert when source has no holes", async () => {
    const admin = mockSupabaseAdmin();
    queueAdminCheck(admin, true);
    admin.queue("tournaments", {
      data: {
        num_holes: 9,
        format: "stroke",
        tee_shot_minimum: 0,
        about_content: null,
        mulligans_enabled: false,
        start_format: "shotgun",
      },
      error: null,
    });
    admin.queue("holes", { data: [], error: null });
    admin.queue("tournaments", { data: { id: "new-id" }, error: null });

    await adminCloneTournamentHandler(admin as any, ADMIN_UUID, input);
    const holeInsert = admin.calls("holes").find((c) => c.method === "insert");
    expect(holeInsert).toBeUndefined();
  });

  it("propagates insert error", async () => {
    const admin = mockSupabaseAdmin();
    queueAdminCheck(admin, true);
    admin.queue("tournaments", {
      data: {
        num_holes: 18,
        format: "stroke",
        tee_shot_minimum: 0,
        about_content: null,
        mulligans_enabled: false,
        start_format: "shotgun",
      },
      error: null,
    });
    admin.queue("holes", { data: [], error: null });
    admin.queue("tournaments", { data: null, error: { message: "insert failed" } });
    await expect(adminCloneTournamentHandler(admin as any, ADMIN_UUID, input)).rejects.toThrow(
      "insert failed",
    );
  });
});