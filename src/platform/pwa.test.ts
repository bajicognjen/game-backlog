/** The update watcher against a fake service worker container: when it offers, and what applying does. */
import { describe, expect, it, vi } from "vitest";
import { trackUpdates, type ContainerLike } from "./pwa";

class FakeContainer extends EventTarget implements ContainerLike {
  controller: unknown = null;
  /** A worker (new or first) has taken control of the page. */
  takeOver() {
    this.controller = {};
    this.dispatchEvent(new Event("controllerchange"));
  }
}

describe("trackUpdates", () => {
  it("stays silent when the first worker takes an uncontrolled page", () => {
    const container = new FakeContainer();
    const onReady = vi.fn();
    trackUpdates(container, onReady, vi.fn());
    container.takeOver();
    expect(onReady).not.toHaveBeenCalled();
  });

  it("offers a reload when a new worker replaces the one that served the page, every time", () => {
    const container = new FakeContainer();
    container.controller = {};
    const onReady = vi.fn();
    const reload = vi.fn();
    trackUpdates(container, onReady, reload);

    container.takeOver();
    expect(onReady).toHaveBeenCalledTimes(1);
    (onReady.mock.calls[0][0] as () => void)();
    expect(reload).toHaveBeenCalledTimes(1);

    container.takeOver();
    expect(onReady).toHaveBeenCalledTimes(2);
  });

  it("after a silent first install, the next worker is an update", () => {
    const container = new FakeContainer();
    const onReady = vi.fn();
    trackUpdates(container, onReady, vi.fn());
    container.takeOver();
    container.takeOver();
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});
