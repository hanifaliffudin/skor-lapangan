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
    functionsInvoke: vi.fn(),
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
    functions: {
      invoke: auth.functionsInvoke,
    },
  },
}));

vi.mock("./runtime-config", () => ({
  get hcaptchaSiteKey() {
    return auth.hcaptchaSiteKey;
  },
}));

function AuthState() {
  const { user, isAnonymous } = useAuth();
  return <output>{user ? `${user.id}:${isAnonymous}` : "no-session"}</output>;
}

function GoogleButton() {
  const { signInWithGoogle } = useAuth();
  return (
    <button type="button" onClick={() => void signInWithGoogle()}>
      Sign in with Google
    </button>
  );
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
    auth.rpc.mockResolvedValue({ data: 0, error: null });
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
  });

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

  it("uses one OAuth flow for an anonymous guest session", async () => {
    const user = userEvent.setup();
    auth.getSession.mockResolvedValue({
      data: { session: auth.guestSession },
      error: null,
    });
    auth.signInWithOAuth.mockResolvedValue({ data: {}, error: null });

    render(
      <StrictMode>
        <MemoryRouter>
          <LocaleProvider>
            <AuthProvider>
              <GoogleButton />
            </AuthProvider>
          </LocaleProvider>
        </MemoryRouter>
      </StrictMode>,
    );
    await user.click(
      await screen.findByRole("button", { name: "Sign in with Google" }),
    );

    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    expect(auth.linkIdentity).not.toHaveBeenCalled();
  });

  it("resets the Google button when the OAuth page is left with Back", async () => {
    const user = userEvent.setup();
    auth.getSession.mockResolvedValue({
      data: { session: auth.guestSession },
      error: null,
    });
    auth.signInWithOAuth.mockResolvedValue({ data: {}, error: null });

    render(<TestApp />);

    await user.click(
      await screen.findByRole("button", { name: "Sign in with Google" }),
    );
    expect(
      await screen.findByRole("button", { name: "Working…" }),
    ).toBeDisabled();

    window.dispatchEvent(new Event("pageshow"));

    expect(
      await screen.findByRole("button", { name: "Sign in with Google" }),
    ).toBeEnabled();
  });

  it("uses OAuth sign-in for an existing non-guest session", async () => {
    const user = userEvent.setup();
    const accountSession = {
      user: {
        id: "account-user",
        is_anonymous: false,
        email: "user@example.com",
      },
    };
    auth.getSession.mockResolvedValue({
      data: { session: accountSession },
      error: null,
    });
    auth.signInWithOAuth.mockResolvedValue({ data: {}, error: null });

    render(
      <StrictMode>
        <MemoryRouter>
          <LocaleProvider>
            <AuthProvider>
              <GoogleButton />
            </AuthProvider>
          </LocaleProvider>
        </MemoryRouter>
      </StrictMode>,
    );
    await user.click(
      await screen.findByRole("button", { name: "Sign in with Google" }),
    );

    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    expect(auth.linkIdentity).not.toHaveBeenCalled();
  });

  it("uses one OAuth flow when a guest chooses an existing Google identity", async () => {
    const user = userEvent.setup();
    auth.getSession.mockResolvedValue({
      data: { session: auth.guestSession },
      error: null,
    });
    auth.signInWithOAuth.mockResolvedValue({ data: {}, error: null });

    render(
      <StrictMode>
        <MemoryRouter>
          <LocaleProvider>
            <AuthProvider>
              <GoogleButton />
            </AuthProvider>
          </LocaleProvider>
        </MemoryRouter>
      </StrictMode>,
    );
    await user.click(
      await screen.findByRole("button", { name: "Sign in with Google" }),
    );

    expect(auth.linkIdentity).not.toHaveBeenCalled();
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  });

  it("uses one OAuth flow when manual identity linking is disabled in Supabase", async () => {
    const user = userEvent.setup();
    auth.getSession.mockResolvedValue({
      data: { session: auth.guestSession },
      error: null,
    });
    auth.signInWithOAuth.mockResolvedValue({ data: {}, error: null });

    render(
      <StrictMode>
        <MemoryRouter>
          <LocaleProvider>
            <AuthProvider>
              <GoogleButton />
            </AuthProvider>
          </LocaleProvider>
        </MemoryRouter>
      </StrictMode>,
    );
    await user.click(
      await screen.findByRole("button", { name: "Sign in with Google" }),
    );

    expect(auth.signInWithOAuth).toHaveBeenCalledTimes(1);
  });

  it("retries OAuth when Supabase returns identity_already_exists in the callback URL", async () => {
    window.history.replaceState(
      {},
      "",
      "/?error_code=identity_already_exists&error=server_error",
    );
    auth.getSession.mockResolvedValue({
      data: { session: auth.guestSession },
      error: null,
    });
    auth.signOut.mockResolvedValue({ error: null });
    auth.signInWithOAuth.mockResolvedValue({ data: {}, error: null });

    render(<TestApp />);

    await waitFor(() => expect(auth.signInWithOAuth).toHaveBeenCalledTimes(1));
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(window.location.search).toBe("");
  });

  it("claims guest matches once after a Google session is restored", async () => {
    const accountSession = {
      user: {
        id: "account-user",
        is_anonymous: false,
        email: "user@example.com",
      },
    };
    auth.getSession.mockResolvedValue({
      data: { session: accountSession },
      error: null,
    });
    auth.rpc.mockResolvedValue({ data: 1, error: null });

    render(<TestApp />);

    await waitFor(() => expect(auth.rpc).toHaveBeenCalledTimes(1));
    expect(auth.rpc).toHaveBeenCalledWith("claim_guest_matches");
  });

  it("signs out and starts a fresh anonymous session", async () => {
    const user = userEvent.setup();
    const accountSession = {
      user: {
        id: "account-user",
        is_anonymous: false,
        email: "user@example.com",
      },
    };
    auth.getSession.mockResolvedValue({
      data: { session: accountSession },
      error: null,
    });
    auth.signOut.mockResolvedValue({ error: null });
    auth.signInAnonymously.mockResolvedValue({
      data: { session: auth.guestSession },
      error: null,
    });

    render(<TestApp />);
    const accountLabels = await screen.findAllByText("user@example.com");
    await user.click(accountLabels[0]!);
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("guest-user:true")).toBeVisible();
  });

  it("deletes the account, clears local matches, and returns to guest mode", async () => {
    const user = userEvent.setup();
    const accountSession = {
      user: {
        id: "account-user",
        is_anonymous: false,
        email: "user@example.com",
      },
    };
    auth.getSession.mockResolvedValue({
      data: { session: accountSession },
      error: null,
    });
    auth.functionsInvoke.mockResolvedValue({
      data: { deleted: true },
      error: null,
    });
    auth.signOut.mockResolvedValue({ error: null });
    auth.signInAnonymously.mockResolvedValue({
      data: { session: auth.guestSession },
      error: null,
    });
    window.localStorage.setItem(
      "skor-lapangan:match:account-match",
      JSON.stringify({ journal: { definition: { id: "account-match" } } }),
    );

    function DeleteAccountButton() {
      const { deleteAccount } = useAuth();
      return (
        <button type="button" onClick={() => void deleteAccount()}>
          Delete account
        </button>
      );
    }

    render(
      <StrictMode>
        <MemoryRouter>
          <LocaleProvider>
            <AuthProvider>
              <DeleteAccountButton />
              <AuthState />
            </AuthProvider>
          </LocaleProvider>
        </MemoryRouter>
      </StrictMode>,
    );

    await user.click(
      await screen.findByRole("button", { name: "Delete account" }),
    );
    expect(auth.functionsInvoke).toHaveBeenCalledWith("delete-account", {
      body: {},
    });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(await screen.findByText("guest-user:true")).toBeVisible();
    expect(
      window.localStorage.getItem("skor-lapangan:match:account-match"),
    ).toBeNull();
  });
});
