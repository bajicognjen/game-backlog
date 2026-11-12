import { describe, expect, it } from "vitest";
import { formatSyncKey, normaliseSyncKey, reconcile, summarizePlan, syncKeyFromBytes } from "./sync";

describe("summarizePlan", () => {
  it("counts games still in the plan, finished games and the hours logged", () => {
    const games = [{ status: "in_progress" }, { status: "pending" }, { status: "paused" }, { status: "completed" }, { status: "dropped" }] as const;
    expect(summarizePlan(games, [{ hours: 1.25 }, { hours: 2 }, { hours: 0.1 }])).toEqual({ inPlan: 3, finished: 1, hoursLogged: 3.4 });
    expect(summarizePlan([], [])).toEqual({ inPlan: 0, finished: 0, hoursLogged: 0 });
  });
});

describe("sync keys", () => {
  it("come out of 20 bytes as 32 base32 characters", () => {
    expect(syncKeyFromBytes(new Uint8Array(20))).toBe("A".repeat(32));
    expect(syncKeyFromBytes(new Uint8Array(20).fill(255))).toBe("7".repeat(32));
    const key = syncKeyFromBytes(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]));
    expect(key).toMatch(/^[A-Z2-7]{32}$/);
    expect(() => syncKeyFromBytes(new Uint8Array(16))).toThrow();
  });

  it("are accepted as typed, in any case, with dashes or spaces", () => {
    const key = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    expect(normaliseSyncKey(formatSyncKey(key))).toBe(key);
    expect(normaliseSyncKey(` ${key.toLowerCase()} `)).toBe(key);
    expect(normaliseSyncKey("abcd efgh ijkl mnop qrst uvwx yz23 4567")).toBe(key);
    expect(normaliseSyncKey(key.slice(1))).toBeNull();
    expect(normaliseSyncKey(key.replace("A", "1"))).toBeNull();
    expect(formatSyncKey(key)).toBe("ABCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ23-4567");
  });
});

describe("reconcile", () => {
  it("pushes when the server has nothing, pulls when only the server moved, and leaves agreement alone", () => {
    expect(reconcile({ revision: 0, dirty: true }, null)).toBe("push");
    expect(reconcile({ revision: 3, dirty: false }, null)).toBe("push");
    expect(reconcile({ revision: 3, dirty: false }, 3)).toBe("nothing");
    expect(reconcile({ revision: 3, dirty: true }, 3)).toBe("push");
    expect(reconcile({ revision: 3, dirty: false }, 5)).toBe("pull");
  });

  it("never decides for the user when both sides changed", () => {
    expect(reconcile({ revision: 3, dirty: true }, 5)).toBe("conflict");
    expect(reconcile({ revision: 5, dirty: false }, 2)).toBe("conflict");
  });
});
