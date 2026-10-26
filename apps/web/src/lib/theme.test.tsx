import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyTheme,
  getStoredThemePreference,
  ThemeProvider,
  useTheme,
} from "./theme";

function ThemeHarness() {
  const { preference, resolvedTheme, setPreference } = useTheme();

  return (
    <div>
      <output role="status">{`${preference}:${resolvedTheme}`}</output>
      <button type="button" onClick={() => setPreference("dark")}>
        dark
      </button>
    </div>
  );
}

describe("theme", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.style.colorScheme = "";
    document.head.innerHTML = '<meta name="theme-color" content="#f7f7f0" />';
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  it("defaults to system when no valid preference is stored", () => {
    window.localStorage.setItem("skor-lapangan:theme", "unknown");

    expect(getStoredThemePreference()).toBe("system");
  });

  it("applies the resolved theme to the document and browser chrome", () => {
    expect(applyTheme("dark")).toBe("dark");
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      "#101419",
    );

    expect(applyTheme("light")).toBe("light");
    expect(document.documentElement).not.toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("persists a user-selected preference", async () => {
    render(
      <ThemeProvider>
        <ThemeHarness />
      </ThemeProvider>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("system:light");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "dark" }));
    });

    expect(screen.getByRole("status")).toHaveTextContent("dark:dark");
    expect(window.localStorage.getItem("skor-lapangan:theme")).toBe("dark");
  });
});
