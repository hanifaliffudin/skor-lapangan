import type { MatchEvent, MatchJournal } from "@skor-lapangan/scoring-core";
import {
  journalSequence,
  journalsHaveSameState,
  type RemoteMatchEventsResult,
  type RemoteMatchErrorCode,
  type RemoteMatchHead,
  type RemoteMatchHeadResult,
  type RemoteMatchResult,
  type RemoteMatchSnapshot,
} from "../../lib/match-remote";
import type { SyncResult } from "../../lib/sync";

export interface MatchLifecycleAdapters {
  loadLocalMatch: (matchId: string) => MatchJournal | null;
  readRemoteMatch: (matchId: string) => Promise<RemoteMatchResult>;
  readRemoteMatchHead: (matchId: string) => Promise<RemoteMatchHeadResult>;
  readRemoteMatchEventsSince: (
    matchId: string,
    afterSequence: number,
  ) => Promise<RemoteMatchEventsResult>;
  appendRemoteEvents: (
    journal: MatchJournal,
    events: MatchEvent[],
  ) => MatchJournal | null;
  matchHeadHasSameState: (
    journal: MatchJournal,
    head: RemoteMatchHead,
  ) => boolean;
  canSyncLocalMatch: (
    matchId: string,
    userId: string,
    isAnonymous: boolean,
  ) => boolean;
  syncJournal: (
    journal: MatchJournal,
    userId: string,
    isAnonymous: boolean,
    controlToken: string | null,
    afterSequence: number,
  ) => Promise<SyncResult>;
  revokeViewerLink: (
    matchId: string,
  ) => Promise<{ status: "ok" } | { status: "error"; error: string }>;
  removeLocalMatch: (matchId: string) => void;
}

export type LoadRemoteResult =
  | { status: "recoverable_missing"; journal: MatchJournal }
  | {
      status: "error";
      error: RemoteMatchErrorCode;
      journal: MatchJournal | null;
    }
  | {
      status: "loaded";
      action: "replace" | "keep";
      journal: MatchJournal | null;
      snapshot: RemoteMatchSnapshot;
    }
  | {
      status: "conflict";
      journal: MatchJournal;
      snapshot: RemoteMatchSnapshot;
    };

export type PollRemoteResult =
  | { status: "unchanged" }
  | { status: "replace"; journal: MatchJournal; sequence: number }
  | {
      status: "conflict";
      snapshot: RemoteMatchSnapshot;
      controlLost: boolean;
    }
  | { status: "unavailable" }
  | { status: "error"; error: RemoteMatchErrorCode };

export type SynchronizeResult =
  | SyncResult
  | { status: "offline" }
  | {
      status: "local";
      reason:
        | "local_only_rules"
        | "not_eligible"
        | "remote_not_ready"
        | "waiting_for_control";
    }
  | { status: "blocked"; reason: "schema" };

export type FinishResult =
  | { status: "completed"; synced: boolean }
  | { status: "offline" }
  | { status: "sync_failed"; result: SyncResult }
  | { status: "revoke_failed"; error: string };

export interface MatchLifecycle {
  loadRemote(input: {
    matchId: string;
    userId: string;
    isAnonymous: boolean;
  }): Promise<LoadRemoteResult>;
  pollRemote(input: {
    matchId: string;
    journal: MatchJournal;
    controlActive: boolean;
  }): Promise<PollRemoteResult>;
  synchronize(input: {
    journal: MatchJournal;
    userId: string;
    isAnonymous: boolean;
    controlToken: string | null;
    afterSequence: number;
    online: boolean;
    localOnlyRules: boolean;
    remoteReady: boolean;
    matchIsActive: boolean;
    controlStatus: string;
    schemaBlocked: boolean;
    retrySchemaBlocked: boolean;
  }): Promise<SynchronizeResult>;
  finish(input: {
    matchId: string;
    journal: MatchJournal;
    userId: string | null;
    isAnonymous: boolean;
    controlToken: string | null;
    afterSequence: number;
    isComplete: boolean;
    online: boolean;
    localOnlyRules: boolean;
    remoteConfigured: boolean;
  }): Promise<FinishResult>;
}

export function createMatchLifecycle(
  adapters: MatchLifecycleAdapters,
): MatchLifecycle {
  return {
    async loadRemote({ matchId, userId, isAnonymous }) {
      const local = adapters.loadLocalMatch(matchId);
      const result = await adapters.readRemoteMatch(matchId);

      if (result.status === "error") {
        if (
          local &&
          result.error === "MATCH_NOT_FOUND" &&
          adapters.canSyncLocalMatch(matchId, userId, isAnonymous)
        ) {
          return { status: "recoverable_missing", journal: local };
        }
        return { status: "error", error: result.error, journal: local };
      }

      const remote = result.snapshot;
      const localSequence = local ? journalSequence(local) : -1;
      if (!local || remote.sequence > localSequence) {
        return {
          status: "loaded",
          action: "replace",
          journal: local,
          snapshot: remote,
        };
      }

      if (
        remote.sequence === localSequence &&
        !journalsHaveSameState(local, remote.journal)
      ) {
        return { status: "conflict", journal: local, snapshot: remote };
      }

      return {
        status: "loaded",
        action: "keep",
        journal: local,
        snapshot: remote,
      };
    },
    async pollRemote({ matchId, journal, controlActive }) {
      const headResult = await adapters.readRemoteMatchHead(matchId);
      if (headResult.status === "error") {
        return headResult.error === "REMOTE_UNAVAILABLE"
          ? { status: "unavailable" }
          : { status: "error", error: headResult.error };
      }

      const localSequence = journalSequence(journal);
      const head = headResult.head;
      if (head.sequence === localSequence) {
        if (adapters.matchHeadHasSameState(journal, head)) {
          return { status: "unchanged" };
        }
        const conflictResult = await adapters.readRemoteMatch(matchId);
        return conflictResult.status === "loaded"
          ? {
              status: "conflict",
              snapshot: conflictResult.snapshot,
              controlLost: controlActive,
            }
          : conflictResult.error === "REMOTE_UNAVAILABLE"
            ? { status: "unavailable" }
            : { status: "error", error: conflictResult.error };
      }

      if (head.sequence < localSequence) return { status: "unchanged" };

      if (controlActive) {
        const conflictResult = await adapters.readRemoteMatch(matchId);
        return conflictResult.status === "loaded"
          ? {
              status: "conflict",
              snapshot: conflictResult.snapshot,
              controlLost: true,
            }
          : conflictResult.error === "REMOTE_UNAVAILABLE"
            ? { status: "unavailable" }
            : { status: "error", error: conflictResult.error };
      }

      const deltaResult = await adapters.readRemoteMatchEventsSince(
        matchId,
        localSequence,
      );
      if (deltaResult.status === "loaded") {
        const nextJournal = adapters.appendRemoteEvents(
          journal,
          deltaResult.events,
        );
        if (
          nextJournal &&
          journalSequence(nextJournal) === head.sequence &&
          adapters.matchHeadHasSameState(nextJournal, head)
        ) {
          return {
            status: "replace",
            journal: nextJournal,
            sequence: head.sequence,
          };
        }
      } else if (deltaResult.error === "REMOTE_UNAVAILABLE") {
        return { status: "unavailable" };
      } else if (deltaResult.error === "INVALID_REMOTE_MATCH") {
        return { status: "error", error: deltaResult.error };
      }

      const fullResult = await adapters.readRemoteMatch(matchId);
      return fullResult.status === "loaded"
        ? {
            status: "replace",
            journal: fullResult.snapshot.journal,
            sequence: fullResult.snapshot.sequence,
          }
        : fullResult.error === "REMOTE_UNAVAILABLE"
          ? { status: "unavailable" }
          : { status: "error", error: fullResult.error };
    },
    async synchronize({
      journal,
      userId,
      isAnonymous,
      controlToken,
      afterSequence,
      online,
      localOnlyRules,
      remoteReady,
      matchIsActive,
      controlStatus,
      schemaBlocked,
      retrySchemaBlocked,
    }) {
      if (localOnlyRules) {
        return { status: "local", reason: "local_only_rules" };
      }
      if (!online) return { status: "offline" };
      if (
        !adapters.canSyncLocalMatch(journal.definition.id, userId, isAnonymous)
      ) {
        return { status: "local", reason: "not_eligible" };
      }
      if (!remoteReady) {
        return { status: "local", reason: "remote_not_ready" };
      }
      if (matchIsActive && controlStatus !== "active") {
        return { status: "local", reason: "waiting_for_control" };
      }
      if (schemaBlocked && !retrySchemaBlocked) {
        return { status: "blocked", reason: "schema" };
      }
      return adapters.syncJournal(
        journal,
        userId,
        isAnonymous,
        controlToken,
        afterSequence,
      );
    },
    async finish({
      matchId,
      journal,
      userId,
      isAnonymous,
      controlToken,
      afterSequence,
      isComplete,
      online,
      localOnlyRules,
      remoteConfigured,
    }) {
      const canSync = Boolean(
        isComplete &&
        !localOnlyRules &&
        remoteConfigured &&
        userId &&
        adapters.canSyncLocalMatch(matchId, userId, isAnonymous),
      );
      let synced = false;
      if (canSync && userId) {
        if (!online) return { status: "offline" };
        const result = await adapters.syncJournal(
          journal,
          userId,
          isAnonymous,
          controlToken,
          afterSequence,
        );
        if (result.status !== "synced") {
          return { status: "sync_failed", result };
        }
        synced = true;
      }

      const revokeResult = await adapters.revokeViewerLink(matchId);
      if (revokeResult.status === "error") {
        return { status: "revoke_failed", error: revokeResult.error };
      }
      adapters.removeLocalMatch(matchId);
      return { status: "completed", synced };
    },
  };
}
