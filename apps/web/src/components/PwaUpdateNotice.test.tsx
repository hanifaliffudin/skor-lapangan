import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../lib/i18n";
import { PwaUpdateNotice } from "./PwaUpdateNotice";

const { applyPwaUpdateMock, isPwaUpdateAvailableMock, subscribeMock } =
  vi.hoisted(() => ({
    applyPwaUpdateMock: vi.fn(),
    isPwaUpdateAvailableMock: vi.fn(),
    subscribeMock: vi.fn(),
  }));

vi.mock("../lib/pwa", () => ({
  applyPwaUpdate: applyPwaUpdateMock,
  isPwaUpdateAvailable: isPwaUpdateAvailableMock,
  subscribeToPwaUpdate: subscribeMock,
}));

describe("PwaUpdateNotice", () => {
  beforeEach(() => {
    applyPwaUpdateMock.mockClear();
    isPwaUpdateAvailableMock.mockReturnValue(true);
    subscribeMock.mockReturnValue(() => undefined);
    applyPwaUpdateMock.mockResolvedValue("deferred");
  });

  afterEach(cleanup);

  it("explains that an update was deferred when Match work is still unsafe", async () => {
    const user = userEvent.setup();
    render(
      <LocaleProvider>
        <PwaUpdateNotice />
      </LocaleProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Update app" }));

    await waitFor(() =>
      expect(
        screen.getByText(
          "Finish active matches or complete pending sync before updating.",
        ),
      ).toBeVisible(),
    );
    expect(applyPwaUpdateMock).toHaveBeenCalledTimes(1);
  });

  it("applies an update and leaves the notice ready for the reload", async () => {
    applyPwaUpdateMock.mockResolvedValue("applied");
    const user = userEvent.setup();
    render(
      <LocaleProvider>
        <PwaUpdateNotice />
      </LocaleProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Update app" }));

    expect(applyPwaUpdateMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Finish active matches/)).not.toBeInTheDocument();
  });
});
