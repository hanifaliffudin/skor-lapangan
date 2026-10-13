import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../lib/i18n";
import { PwaInstallControl } from "./PwaInstallControl";

function renderControl(hasUserEngaged = true) {
  return render(
    <LocaleProvider>
      <PwaInstallControl hasUserEngaged={hasUserEngaged} />
    </LocaleProvider>,
  );
}

function installEvent(outcome: "accepted" | "dismissed" = "accepted"): Event {
  const event = new Event("beforeinstallprompt");
  Object.defineProperties(event, {
    prompt: { value: vi.fn().mockResolvedValue(undefined) },
    userChoice: {
      value: Promise.resolve({ outcome, platform: "web" }),
    },
  });
  return event;
}

describe("PwaInstallControl", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("waits until the user has interacted with quick start", async () => {
    const { rerender } = renderControl(false);

    act(() => window.dispatchEvent(installEvent()));
    expect(
      screen.queryByRole("heading", { name: "Install Skor Lapangan" }),
    ).toBeNull();

    rerender(
      <LocaleProvider>
        <PwaInstallControl hasUserEngaged />
      </LocaleProvider>,
    );
    expect(
      await screen.findByRole("heading", { name: "Install Skor Lapangan" }),
    ).toBeVisible();
  });

  it("snoozes the prompt when the user chooses not now", async () => {
    const user = userEvent.setup();
    renderControl();
    act(() => window.dispatchEvent(installEvent()));

    await user.click(screen.getByRole("button", { name: "Not now" }));

    expect(
      screen.queryByRole("heading", { name: "Install Skor Lapangan" }),
    ).toBeNull();
    expect(
      window.localStorage.getItem("skor-lapangan:install-snoozed-until"),
    ).not.toBeNull();
  });

  it("hides the prompt after the native install is accepted", async () => {
    const user = userEvent.setup();
    renderControl();
    const event = installEvent();
    const prompt = (event as Event & { prompt: ReturnType<typeof vi.fn> })
      .prompt;
    act(() => window.dispatchEvent(event));

    await user.click(
      screen.getByRole("button", { name: "Install Skor Lapangan" }),
    );

    expect(prompt).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("heading", { name: "Install Skor Lapangan" }),
    ).toBeNull();
  });
});
