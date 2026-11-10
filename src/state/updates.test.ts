/** The web branch of the update store: a waiting worker becomes a reload offer. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUpdates } from "./updates";

beforeEach(() => useUpdates.getState().dismiss());

describe("offerReload", () => {
  it("shows the offer, and Reload applies it", () => {
    const apply = vi.fn();
    useUpdates.getState().offerReload(apply);
    expect(useUpdates.getState().status).toBe("reloadReady");
    useUpdates.getState().reload();
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("Later hides the offer and forgets the worker", () => {
    const apply = vi.fn();
    useUpdates.getState().offerReload(apply);
    useUpdates.getState().dismiss();
    expect(useUpdates.getState().status).toBe("idle");
    useUpdates.getState().reload();
    expect(apply).not.toHaveBeenCalled();
  });
});
