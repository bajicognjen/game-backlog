import { describe, expect, it } from "vitest";
import { SyncError } from "../platform/sync";
import { plainFailure } from "./sync";

describe("plainFailure", () => {
  it("says what went wrong with a sync button and what to do, without codes or internal reasons", () => {
    expect(plainFailure(new SyncError("network"))).toBe("The sync server can't be reached. Check the connection and try again.");
    expect(plainFailure(new SyncError("other", 502))).toBe("The sync server had a problem and couldn't do that. Try again in a minute.");
    expect(plainFailure(new Error("Something odd."))).toBe("That didn't work: Something odd. Try again.");
    for (const message of [plainFailure(new SyncError("network")), plainFailure(new SyncError("other", 500))]) {
      expect(message).not.toMatch(/HTTP|\d{3}|network\)|other\)/);
    }
  });
});
