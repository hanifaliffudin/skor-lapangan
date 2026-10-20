import { describe, expect, it, vi } from "vitest";
import {
  awardRally,
  deriveJournal,
  type MatchJournal,
} from "@skor-lapangan/scoring-core";
import { createMatchLifecycle } from "./matchLifecycle";

const matchId = "7550e45b-28c8-4be7-8127-810454a45c64";

function journal(): MatchJournal {
  return {
    definition: {
      id: matchId,
      sport: "badminton",
      rulesetId: "bwf-doubles-3x21-2025",
      mode: "casual",
      createdAt: "2026-10-08T00:00:00.000Z",
      initialServingTeam: "A",
      initialServingPlayer: 0,
      teams: {
        A: {
          name: "Team A",
          players: [
            { id: "a-1", name: "A1" },
            { id: "a-2", name: "A2" },
          ],
        },
        B: {
          name: "Team B",
          players: [
            { id: "b-1", name: "B1" },
            { id: "b-2", name: "B2" },
          ],
        },
      },
    },
    events: [],
  };
}

describe("Match lifecycle", () => {
  it("allows an eligible local journal to recover a missing remote Match", async () => {
    const local = journal();
    const lifecycle = createMatchLifecycle({
      loadLocalMatch: vi.fn(() => local),
      readRemoteMatch: vi.fn().mockResolvedValue({
        status: "error",
        error: "MATCH_NOT_FOUND",
      }),
      readRemoteMatchHead: vi.fn(),
      readRemoteMatchEventsSince: vi.fn(),
      appendRemoteEvents: vi.fn(),
      matchHeadHasSameState: vi.fn(),
      canSyncLocalMatch: vi.fn(() => true),
      syncJournal: vi.fn(),
      revokeViewerLink: vi.fn(),
      removeLocalMatch: vi.fn(),
    });

    await expect(
      lifecycle.loadRemote({
        matchId,
        userId: "account-user",
        isAnonymous: false,
      }),
    ).resolves.toEqual({
      status: "recoverable_missing",
      journal: local,
    });
  });

  it("applies a complete remote event delta when the head matches it", async () => {
    const local = journal();
    const next = awardRally(local, "A", {
      id: "42e0b088-1678-4c64-9bf0-d978ba68b458",
      createdAt: "2026-10-08T00:01:00.000Z",
    });
    const lifecycle = createMatchLifecycle({
      loadLocalMatch: vi.fn(() => local),
      readRemoteMatch: vi.fn(),
      readRemoteMatchHead: vi.fn().mockResolvedValue({
        status: "loaded",
        head: {
          status: "active",
          currentState: deriveJournal(next).state,
          sequence: 1,
          updatedAt: "2026-10-08T00:01:00.000Z",
        },
      }),
      readRemoteMatchEventsSince: vi.fn().mockResolvedValue({
        status: "loaded",
        events: next.events,
      }),
      appendRemoteEvents: vi.fn(() => next),
      matchHeadHasSameState: vi.fn(() => true),
      canSyncLocalMatch: vi.fn(),
      syncJournal: vi.fn(),
      revokeViewerLink: vi.fn(),
      removeLocalMatch: vi.fn(),
    });

    await expect(
      lifecycle.pollRemote({
        matchId,
        journal: local,
        controlActive: false,
      }),
    ).resolves.toEqual({
      status: "replace",
      journal: next,
      sequence: 1,
    });
  });

  it("keeps an active Match local while control is not active", async () => {
    const syncJournal = vi.fn();
    const lifecycle = createMatchLifecycle({
      loadLocalMatch: vi.fn(() => journal()),
      readRemoteMatch: vi.fn(),
      readRemoteMatchHead: vi.fn(),
      readRemoteMatchEventsSince: vi.fn(),
      appendRemoteEvents: vi.fn(),
      matchHeadHasSameState: vi.fn(),
      canSyncLocalMatch: vi.fn(() => true),
      syncJournal,
      revokeViewerLink: vi.fn(),
      removeLocalMatch: vi.fn(),
    });

    await expect(
      lifecycle.synchronize({
        journal: journal(),
        userId: "account-user",
        isAnonymous: false,
        controlToken: "control-token",
        afterSequence: 0,
        online: true,
        localOnlyRules: false,
        remoteReady: true,
        matchIsActive: true,
        controlStatus: "waiting",
        schemaBlocked: false,
        retrySchemaBlocked: false,
      }),
    ).resolves.toEqual({ status: "local", reason: "waiting_for_control" });
    expect(syncJournal).not.toHaveBeenCalled();
  });

  it("keeps the local Match when final synchronization fails", async () => {
    const removeLocalMatch = vi.fn();
    const syncResult = { status: "conflict", error: "SYNC_CONFLICT" } as const;
    const lifecycle = createMatchLifecycle({
      loadLocalMatch: vi.fn(() => journal()),
      readRemoteMatch: vi.fn(),
      readRemoteMatchHead: vi.fn(),
      readRemoteMatchEventsSince: vi.fn(),
      appendRemoteEvents: vi.fn(),
      matchHeadHasSameState: vi.fn(),
      canSyncLocalMatch: vi.fn(() => true),
      syncJournal: vi.fn().mockResolvedValue(syncResult),
      revokeViewerLink: vi.fn(),
      removeLocalMatch,
    });

    await expect(
      lifecycle.finish({
        matchId,
        journal: journal(),
        userId: "account-user",
        isAnonymous: false,
        controlToken: "control-token",
        afterSequence: 0,
        isComplete: true,
        online: true,
        localOnlyRules: false,
        remoteConfigured: true,
      }),
    ).resolves.toEqual({ status: "sync_failed", result: syncResult });
    expect(removeLocalMatch).not.toHaveBeenCalled();
  });

  it("owns polling cadence and stops after cleanup", async () => {
    vi.useFakeTimers();
    const pollRemote = vi.fn().mockResolvedValue({ status: "unchanged" });
    const onResult = vi.fn();
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    const lifecycle = createMatchLifecycle({
      loadLocalMatch: vi.fn(() => journal()),
      readRemoteMatch: vi.fn(),
      readRemoteMatchHead: vi.fn(),
      readRemoteMatchEventsSince: vi.fn(),
      appendRemoteEvents: vi.fn(),
      matchHeadHasSameState: vi.fn(),
      canSyncLocalMatch: vi.fn(),
      syncJournal: vi.fn(),
      revokeViewerLink: vi.fn(),
      removeLocalMatch: vi.fn(),
    });
    const lifecycleWithPolling = {
      ...lifecycle,
      pollRemote,
    };
    const stop = lifecycleWithPolling.watchRemote({
      matchId,
      getJournal: () => journal(),
      controlActive: () => false,
      onResult,
      onFailure: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(10_000);
    expect(pollRemote).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith({ status: "unchanged" });
    stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(pollRemote).toHaveBeenCalledTimes(1);

    random.mockRestore();
    vi.useRealTimers();
  });

  it("backs off after a polling failure", async () => {
    vi.useFakeTimers();
    const pollRemote = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue({ status: "unchanged" });
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    const lifecycle = createMatchLifecycle({
      loadLocalMatch: vi.fn(() => journal()),
      readRemoteMatch: vi.fn(),
      readRemoteMatchHead: vi.fn(),
      readRemoteMatchEventsSince: vi.fn(),
      appendRemoteEvents: vi.fn(),
      matchHeadHasSameState: vi.fn(),
      canSyncLocalMatch: vi.fn(),
      syncJournal: vi.fn(),
      revokeViewerLink: vi.fn(),
      removeLocalMatch: vi.fn(),
    });
    const lifecycleWithPolling = {
      ...lifecycle,
      pollRemote,
    };
    const stop = lifecycleWithPolling.watchRemote({
      matchId,
      getJournal: () => journal(),
      controlActive: () => false,
      onResult: vi.fn(),
      onFailure: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(10_000);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(pollRemote).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(pollRemote).toHaveBeenCalledTimes(2);

    stop();
    random.mockRestore();
    vi.useRealTimers();
  });
});
