import {
  cleanup,
  render as rtlRender,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../../lib/i18n";
import { ThemeProvider } from "../../lib/theme";
import { defaultCommunityRuleConfiguration } from "./communityRule";
import {
  CommunityRuleDetailPage,
  CommunityRuleEditorPage,
  CommunityRulesDirectoryPage,
} from "./CommunityRulesPage";

function render(ui: Parameters<typeof rtlRender>[0]) {
  return rtlRender(<ThemeProvider>{ui}</ThemeProvider>);
}

const { rpcMock, authState } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  authState: {
    action: "idle",
    authError: null,
    authErrorKind: null,
    authNotice: null,
    isAnonymous: false,
    loading: false,
    retryGuestSession: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
    user: null as { id: string } | null,
  },
}));

vi.mock("../../lib/auth", () => ({
  useAuth: () => authState,
}));

vi.mock("../../lib/auth-context", () => ({
  useAuth: () => authState,
}));

vi.mock("../../lib/supabase", () => ({
  supabase: { rpc: rpcMock },
}));

const publicRule = {
  id: "public-tennis-rule",
  author_id: "rule-author",
  sport: "tennis",
  title: "Weekend Tennis",
  description: "A friendly local format.",
  current_version: 2,
  is_published: true,
  created_at: "2026-10-14T00:00:00.000Z",
  updated_at: "2026-10-14T00:00:00.000Z",
  is_owner: false,
};

function renderRoute(path: string, element: React.ReactNode) {
  const routePath =
    path === "/rules/new"
      ? "/rules/new"
      : path.endsWith("/edit")
        ? "/rules/:ruleId/edit"
        : path === "/rules"
          ? "/rules"
          : "/rules/:ruleId";
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocaleProvider>
        <Routes>
          <Route path={routePath} element={element} />
          <Route path="/setup" element={<div />} />
        </Routes>
      </LocaleProvider>
    </MemoryRouter>,
  );
}

describe("Community Rules pages", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    authState.user = null;
    authState.isAnonymous = false;
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders published rules and filters them by sport", async () => {
    rpcMock.mockResolvedValue({
      data: [
        publicRule,
        {
          ...publicRule,
          id: "public-padel-rule",
          sport: "padel",
          title: "Club Padel",
        },
      ],
      error: null,
    });

    const user = userEvent.setup();
    renderRoute("/rules", <CommunityRulesDirectoryPage />);

    const tennisRuleLink = await screen.findByRole("link", {
      name: /Weekend Tennis.*View rules/,
    });
    expect(tennisRuleLink).toBeVisible();
    await user.click(screen.getByLabelText("Sport"));
    await user.click(await screen.findByRole("option", { name: "Padel" }));

    expect(
      screen.getByRole("link", { name: /Club Padel.*View rules/ }),
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: /Weekend Tennis.*View rules/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to home/ })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      screen.queryByRole("navigation", { name: "Main navigation" }),
    ).not.toBeInTheDocument();
  });

  it("sends community rule search to the paginated server query", async () => {
    rpcMock.mockResolvedValue({ data: [publicRule], error: null });
    const user = userEvent.setup();
    renderRoute("/rules", <CommunityRulesDirectoryPage />);

    await screen.findByRole("link", { name: /Weekend Tennis.*View rules/ });
    await user.type(screen.getByRole("searchbox"), "Weekend");

    await waitFor(() => {
      expect(rpcMock).toHaveBeenLastCalledWith(
        "list_community_rules_page",
        expect.objectContaining({
          p_sport: null,
          p_search: "Weekend",
          p_scope: "all",
        }),
      );
    });
  });

  it("keeps the current version and community source when using a rule", async () => {
    rpcMock.mockImplementation((functionName: string) => {
      if (functionName === "read_community_rule") {
        return Promise.resolve({ data: [publicRule], error: null });
      }
      return Promise.resolve({
        data: [
          {
            rule_id: publicRule.id,
            version: publicRule.current_version,
            configuration: defaultCommunityRuleConfiguration("tennis"),
          },
        ],
        error: null,
      });
    });

    const user = userEvent.setup();
    renderRoute("/rules/public-tennis-rule", <CommunityRuleDetailPage />);

    expect(
      await screen.findByRole("heading", { name: "Weekend Tennis" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /Back to community rules/ }),
    ).toHaveAttribute("href", "/rules");
    expect(screen.getByRole("button", { name: "Share link" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Use this ruleset" }));

    expect(
      JSON.parse(window.sessionStorage.getItem("skor-lapangan:setup-draft")!),
    ).toEqual({
      sport: "tennis",
      format: "doubles",
      mode: "casual",
      communityRuleId: publicRule.id,
    });
  });

  it("confirms a report and lets the reporter start another one", async () => {
    authState.user = { id: "guest-report" };
    authState.isAnonymous = true;
    rpcMock.mockImplementation((functionName: string) => {
      if (functionName === "read_community_rule") {
        return Promise.resolve({ data: [publicRule], error: null });
      }
      if (functionName === "read_community_rule_version") {
        return Promise.resolve({
          data: [
            {
              rule_id: publicRule.id,
              version: publicRule.current_version,
              configuration: defaultCommunityRuleConfiguration("tennis"),
            },
          ],
          error: null,
        });
      }
      if (functionName === "report_community_rule_v2") {
        return Promise.resolve({ data: "report-id", error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const user = userEvent.setup();
    renderRoute("/rules/public-tennis-rule", <CommunityRuleDetailPage />);

    await screen.findByRole("heading", { name: "Report this ruleset" });
    await user.click(screen.getByRole("button", { name: "Submit report" }));

    expect(
      await screen.findByRole("heading", {
        name: "Your report has been recorded.",
      }),
    ).toBeVisible();
    expect(screen.getByText(/A reviewer will check it manually/)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Submit report" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Report another problem" }),
    ).toBeVisible();
    expect(rpcMock).toHaveBeenCalledWith("report_community_rule_v2", {
      p_rule_id: publicRule.id,
      p_reason: "misleading",
      p_details: "",
      p_reporter_contact: null,
    });

    await user.click(
      screen.getByRole("button", { name: "Report another problem" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Report this ruleset" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Submit report" })).toBeVisible();
  });

  it("lets the owner republish without creating a new version", async () => {
    const unpublishedOwnerRule = {
      ...publicRule,
      is_published: false,
      is_owner: true,
    };
    rpcMock.mockImplementation((functionName: string) => {
      if (functionName === "read_community_rule") {
        return Promise.resolve({ data: [unpublishedOwnerRule], error: null });
      }
      if (functionName === "read_community_rule_version") {
        return Promise.resolve({
          data: [
            {
              rule_id: unpublishedOwnerRule.id,
              version: unpublishedOwnerRule.current_version,
              configuration: defaultCommunityRuleConfiguration("tennis"),
            },
          ],
          error: null,
        });
      }
      if (functionName === "publish_community_rule") {
        return Promise.resolve({ data: true, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
    authState.user = { id: "rule-author" };

    const user = userEvent.setup();
    renderRoute("/rules/public-tennis-rule", <CommunityRuleDetailPage />);

    const republishButton = await screen.findByRole("button", {
      name: "Republish",
    });
    await user.click(republishButton);

    expect(rpcMock).toHaveBeenCalledWith("publish_community_rule", {
      p_rule_id: unpublishedOwnerRule.id,
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "This ruleset is public again. Its version remains unchanged.",
    );
    expect(screen.getByText("Version 2")).toBeVisible();
  });

  it("shows a load error instead of blaming ownership", async () => {
    authState.user = { id: "rule-author" };
    rpcMock.mockResolvedValue({
      data: null,
      error: new Error("temporary backend failure"),
    });

    renderRoute("/rules/public-tennis-rule/edit", <CommunityRuleEditorPage />);

    expect(
      await screen.findByText(
        "This ruleset could not be loaded. Choose another one.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByText("Only the rule creator can edit it."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Back to community rules/ }),
    ).toHaveAttribute("href", "/rules");
  });

  it("normalizes leading zeroes in editable scoring fields", async () => {
    const user = userEvent.setup();
    authState.user = { id: "rule-author" };

    renderRoute("/rules/new", <CommunityRuleEditorPage />);

    expect(
      screen.getByRole("link", { name: /Back to community rules/ }),
    ).toHaveAttribute("href", "/rules");
    const pointsToWin = screen.getByDisplayValue("21");
    await user.clear(pointsToWin);
    await user.type(pointsToWin, "042");

    expect(pointsToWin).toHaveValue("42");
  });
});
