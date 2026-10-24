import { beforeEach, describe, expect, it, vi } from "vitest";

const { applyUpdateMock, hasActiveOrPendingMatchesMock, registerSWMock } =
  vi.hoisted(() => {
    const applyUpdate = vi.fn().mockResolvedValue(undefined);
    return {
      applyUpdateMock: applyUpdate,
      hasActiveOrPendingMatchesMock: vi.fn(),
      registerSWMock: vi.fn(() => applyUpdate),
    };
  });

vi.mock("virtual:pwa-register", () => ({ registerSW: registerSWMock }));
vi.mock("./session", () => ({
  hasActiveOrPendingMatches: hasActiveOrPendingMatchesMock,
}));

import { applyPwaUpdate } from "./pwa";

describe("PWA update activation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    applyUpdateMock.mockResolvedValue(undefined);
  });

  it("defers activation while a Match is active or pending sync", async () => {
    hasActiveOrPendingMatchesMock.mockResolvedValue(true);

    await expect(applyPwaUpdate()).resolves.toBe("deferred");
    expect(applyUpdateMock).not.toHaveBeenCalled();
  });

  it("activates the waiting service worker after the Match state is safe", async () => {
    hasActiveOrPendingMatchesMock.mockResolvedValue(false);

    await expect(applyPwaUpdate()).resolves.toBe("applied");
    expect(applyUpdateMock).toHaveBeenCalledWith(true);
  });
});
