import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { LocaleProvider } from "./lib/i18n";

describe("quick start", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("switches between the required Indonesian and English copy", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Skor jelas. Laga tetap jalan." }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "EN" }));
    expect(
      screen.getByRole("heading", {
        name: "Clear score. Keep the game moving.",
      }),
    ).toBeVisible();
  });

  it("stores the selected local setup before navigation", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("radio", { name: "Pickleball Ganda · 3 angka" }),
    );
    await user.click(
      screen.getByRole("radio", { name: "Wasit Kontrol lebih lengkap" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Lanjut atur pemain" }),
    );

    expect(
      screen.getByRole("heading", { name: "Siapa yang bermain?" }),
    ).toBeVisible();
    expect(window.sessionStorage.getItem("skor-lapangan:setup-draft")).toBe(
      JSON.stringify({ sport: "pickleball", mode: "referee" }),
    );
  });

  it("explains when Google is not enabled instead of starting a broken login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ external: { google: false } }),
      }),
    );
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: "Masuk dengan Google" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Google login belum siap" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Koneksi Supabase aktif, tetapi provider Google belum diaktifkan di dashboard.",
      ),
    ).toBeVisible();
  });
});
