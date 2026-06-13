import { describe, it, expect } from "vitest";
import { mockSupabaseAdmin } from "@/test/helpers";
import { RedeemSchema, redeemOverrideCodeHandler } from "@/lib/captain.functions";

describe("RedeemSchema", () => {
  it("rejects bad email", () => {
    expect(() => RedeemSchema.parse({ code: "ABCD", email: "nope" })).toThrow();
  });
  it("rejects short code", () => {
    expect(() => RedeemSchema.parse({ code: "AB", email: "a@b.co" })).toThrow();
  });
  it("accepts valid input", () => {
    expect(RedeemSchema.parse({ code: "ABCD", email: "a@b.co" })).toEqual({
      code: "ABCD",
      email: "a@b.co",
    });
  });
});

describe("redeemOverrideCodeHandler", () => {
  it("returns Invalid override code when tournament missing", async () => {
    const admin = mockSupabaseAdmin();
    admin.queue("tournaments", { data: null, error: null });
    await expect(
      redeemOverrideCodeHandler(admin, { code: "abcd", email: "a@b.co" }),
    ).rejects.toThrow("Invalid override code");
  });

  it("rejects when email is not a captain on that tournament", async () => {
    const admin = mockSupabaseAdmin();
    admin.queue("tournaments", { data: { id: "t1", name: "Cup", status: "draft" }, error: null });
    admin.queue("teams", { data: null, error: null });
    await expect(
      redeemOverrideCodeHandler(admin, { code: "abcd", email: "a@b.co" }),
    ).rejects.toThrow(/not registered as a captain/);
  });

  it("normalizes code (uppercase) and email (lowercase)", async () => {
    const admin = mockSupabaseAdmin();
    admin.queue("tournaments", { data: { id: "t1", name: "Cup", status: "draft" }, error: null });
    admin.queue("teams", { data: { id: "team1", name: "Birdies" }, error: null });
    const res = await redeemOverrideCodeHandler(admin, {
      code: " abcd ",
      email: " Foo@BAR.com ",
    });
    expect(res).toEqual({
      tokenHash: "tok_test",
      email: "foo@bar.com",
      tournamentName: "Cup",
      teamName: "Birdies",
    });
    const tEq = admin.calls("tournaments").find((c) => c.method === "eq");
    expect(tEq?.args).toEqual(["override_code", "ABCD"]);
    const ilike = admin.calls("teams").find((c) => c.method === "ilike");
    expect(ilike?.args).toEqual(["captain_email", "foo@bar.com"]);
  });

  it("surfaces generateLink error", async () => {
    const admin = mockSupabaseAdmin();
    admin.queue("tournaments", { data: { id: "t1", name: "Cup", status: "draft" }, error: null });
    admin.queue("teams", { data: { id: "team1", name: "Birdies" }, error: null });
    admin._generateLink.mockResolvedValueOnce({
      data: { properties: {} },
      error: { message: "gen fail" },
    } as never);
    await expect(
      redeemOverrideCodeHandler(admin, { code: "abcd", email: "a@b.co" }),
    ).rejects.toThrow("gen fail");
  });
});