import type { MatchEvent, MatchJournal } from "@skor-lapangan/scoring-core";

export interface MatchRecoveryIdentity {
  createId: () => string;
  now: () => string;
}

const browserIdentity: MatchRecoveryIdentity = {
  createId: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
};

export function forkMatchAsNew(
  journal: MatchJournal,
  identity: MatchRecoveryIdentity = browserIdentity,
): MatchJournal {
  const matchId = identity.createId();
  const eventIds = new Map<string, string>();
  const events = journal.events.map((event) => {
    const id = identity.createId();
    eventIds.set(event.id, id);
    return { ...event, id, matchId };
  });

  return {
    definition: {
      ...journal.definition,
      id: matchId,
      createdAt: identity.now(),
    },
    events: events.map((event) => remapEventTarget(event, eventIds)),
    ...(journal.finalState
      ? { finalState: { ...journal.finalState, matchId } }
      : {}),
  };
}

function remapEventTarget(
  event: MatchEvent,
  eventIds: Map<string, string>,
): MatchEvent {
  if (event.type !== "undo_applied" && event.type !== "redo_applied") {
    return event;
  }
  return {
    ...event,
    targetEventId: eventIds.get(event.targetEventId) ?? event.targetEventId,
  };
}
