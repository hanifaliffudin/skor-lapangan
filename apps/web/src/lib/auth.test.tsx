import { StrictMode } from "react";
import { createElement } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppHeader } from "../components/AppHeader";
import { LocaleProvider } from "./i18n";
import { AuthProvider, useAuth } from "./auth";

type AuthListener = (event: string, session: unknown) => void;

const auth = vi.hoisted(() => {
  const guestSession = {
    user: { id: "guest-user", is_anonymous: true },
  };

  return {
    guestSession,
    getSession: vi.fn(),
    signInAnonymously: vi.fn(),
    signOut: vi.fn(),
    signInWithOAuth: vi.fn(),
    linkIdentity: vi.fn(),
    onAuthStateChange: vi.fn(),
    rpc: vi.fn(),
    hcaptchaSiteKey: "test-site-key" as string | null,
  };
});

vi.mock("@hcaptcha/react-hcaptcha", () => ({
  default: ({
    sitekey,
    onVerify,
  }: {
    sitekey: string;
    onVerify: (token: string) => void;
  }) =>
    createElement(
      "button",
      {
        type: "button",
        "data-sitekey": sitekey,
        onClick: () => onVerify("test-captcha-token"),
      },
      "Complete hCaptcha",
    ),
}));

vi.mock("./supabase", () => ({
  hasSupabaseConfig: true,
  get hcaptchaSiteKey() {
    return auth.hcaptchaSiteKey;
  },
  supabase: {
    auth: {
      getSession: auth.getSession,
      signInAnonymously: auth.signInAnonymously,
      signOut: auth.signOut,
      signInWithOAuth: auth.signInWithOAuth,
      linkIdentity: auth.linkIdentity,
      onAuthStateChange: auth.onAuthStateChange,
    },
    rpc: auth.rpc,
  },
}));

function AuthState() {
  const { user, isAnonymous } = useAuth();
  return <output>{user ? `${user.id}:${isAnonymous}` : "no-session"}</output>;
}

function TestApp() {
  return (
    <StrictMode>
      <MemoryRouter>
        <LocaleProvider>
          <AuthProvider>
            <AppHeader />
            <AuthState />
          </AuthProvider>
        </LocaleProvider>
      </MemoryRouter>
    </StrictMode>
  );
}

describe("guest authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.hcaptchaSiteKey = "test-site-key";
    auth.onAuthStateChange.mockImplementation((listener: AuthListener) => {
      listener("INITIAL_SESSION", null);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  });

  afterEach(cleanup);

  it("starts an anonymous session when Supabase emits an empty initial session", async () => {
    auth.signInAnonymously.mockResolvedValue({
      data: { session: auth.guestSession },
      error: null,
    });

    render(<TestApp />);

    expect(await screen.findByText("guest-user:true")).toBeVisible();
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows anonymous sign-in errors and retries guest sync successfully", async () => {
    const user = userEvent.setup();
    auth.signInAnonymously
      .mockResolvedValueOnce({
        data: { session: null },
        error: { message: "Anonymous sign-ins are disabled" },
      })
      .mockResolvedValueOnce({
        data: { session: auth.guestSession },
        error: null,
      });

    render(<TestApp />);

    expect(
      await screen.findByText(
        /Guest cloud sync could not start: Anonymous sign-ins are disabled/,
      ),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Retry guest connection" }),
    );

    expect(await screen.findByText("guest-user:true")).toBeVisible();
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("passes a verified hCaptcha token to anonymous sign-in", async () => {
    const user = userEvent.setup();
    auth.signInAnonymously
      .mockResolvedValueOnce({
        data: { session: null },
        error: { message: "captcha protection: no captcha_token found" },
      })
      .mockResolvedValueOnce({
        data: { session: auth.guestSession },
        error: null,
      });

    render(<TestApp />);

    expect(await screen.findByText("Complete hCaptcha")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Complete hCaptcha" }));

    expect(await screen.findByText("guest-user:true")).toBeVisible();
    expect(auth.signInAnonymously).toHaveBeenNthCalledWith(1);
    expect(auth.signInAnonymously).toHaveBeenNthCalledWith(2, {
      options: { captchaToken: "test-captcha-token" },
    });
  });

  it("explains when hCaptcha is enabled without a public site key", async () => {
    auth.hcaptchaSiteKey = null;
    auth.signInAnonymously.mockResolvedValue({
      data: { session: null },
      error: { message: "captcha protection: no captcha_token found" },
    });

    render(<TestApp />);

    expect(await screen.findByText(/VITE_HCAPTCHA_SITE_KEY/)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Retry guest connection" }),
    ).not.toBeInTheDocument();
  });
});
