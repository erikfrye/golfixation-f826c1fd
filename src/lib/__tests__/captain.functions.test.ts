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
      redeemOverrideCodeHandler(admin as any, { code: "abcd", email: "a@b.co" }),
    ).rejects.toThrow("Invalid override code");
  });

  it("rejects when email is not a captain on that tournament", async () => {
    const admin = mockSupabaseAdmin();
    admin.queue("tournaments", { data: { id: "t1", name: "Cup", status: "draft" }, error: null });
    admin.queue("teams", { data: null, error: null });
    await expect(
      redeemOverrideCodeHandler(admin as any, { code: "abcd", email: "a@b.co" }),
    ).rejects.toThrow(/not registered as a captain/);
  });

  it("normalizes code (uppercase) and email (lowercase)", async () => {
    const admin = mockSupabaseAdmin();
    admin.queue("tournaments", { data: { id: "t1", name: "Cup", status: "draft" }, error: null });
    admin.queue("teams", { data: { id: "team1", name: "Birdies" }, error: null });
    const res = await redeemOverrideCodeHandler(admin as any, {
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
      redeemOverrideCodeHandler(admin as any, { code: "abcd", email: "a@b.co" }),
    ).rejects.toThrow("gen fail");
  });

  it("provisions a first-time captain account before generating the link", async () => {
    const admin = mockSupabaseAdmin();
    admin.queue("tournaments", { data: { id: "t1", name: "Cup", status: "draft" }, error: null });
    admin.queue("teams", { data: { id: "team1", name: "Birdies" }, error: null });
    const res = await redeemOverrideCodeHandler(admin as any, {
      code: "abcd",
      email: "New@Cap.com",
    });
    expect(admin._createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "new@cap.com", email_confirm: true }),
    );
    expect(res.tokenHash).toBe("tok_test");
  });

  it("continues when the captain account already exists", async () => {
    const admin = mockSupabaseAdmin();
    admin.queue("tournaments", { data: { id: "t1", name: "Cup", status: "draft" }, error: null });
    admin.queue("teams", { data: { id: "team1", name: "Birdies" }, error: null });
    admin._createUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "A user with this email address has already been registered" },
    } as never);
    const res = await redeemOverrideCodeHandler(admin as any, { code: "abcd", email: "a@b.co" });
    expect(res.tokenHash).toBe("tok_test");
  });

  it("fails and logs when account provisioning errors", async () => {
    const admin = mockSupabaseAdmin();
    admin.queue("tournaments", { data: { id: "t1", name: "Cup", status: "draft" }, error: null });
    admin.queue("teams", { data: { id: "team1", name: "Birdies" }, error: null });
    admin._createUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "db down" },
    } as never);
    await expect(
      redeemOverrideCodeHandler(admin as any, { code: "abcd", email: "a@b.co" }),
    ).rejects.toThrow("db down");
    const insert = admin.calls("override_code_redemptions").find((c) => c.method === "insert");
    expect((insert?.args[0] as any).failure_reason).toBe("user_provision_failed");
  });
});