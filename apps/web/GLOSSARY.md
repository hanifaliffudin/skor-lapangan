# Web Workflows

This context defines the user-facing workflows for starting, scoring, sharing, and completing matches.

## Language

**Match**:
A scored sporting contest with participants, a ruleset, a current score, and a completion state.
_Avoid_: Game, session

**Match lifecycle**:
The progression of a Match from local start through active scoring, synchronization and recovery, to completion.
_Avoid_: Match flow, match service

**Control**:
The right to make scoring changes to an active Match from one browser tab or device at a time.
_Avoid_: Lock, ownership

**Live Viewer**:
A read-only view of a Match's server-backed score state shared through an explicit link.
_Avoid_: Spectator mode, public match

**Offline Match Continuity**:
The ability to start, score, complete, and recover a Match on the controlling device without a network connection, then synchronize it when the connection returns.
_Avoid_: Offline mode, disconnected match

**Pending sync**:
The state of a completed Match whose local result is retained but has not yet been accepted by the server.
_Avoid_: Unsaved match, failed match

**Sync conflict**:
A condition where the local Match and the server contain incompatible changes that cannot be merged safely without an explicit operator choice.
_Avoid_: Sync error, duplicate match

**Club Session**:
An organizer-led open-play session that groups a roster, courts, a queue, and the Matches played during that session.
_Avoid_: Event, tournament

**Club Session Match**:
A Match planned within a Club Session, with its players, court, and queue position chosen before scoring begins.
_Avoid_: queued game, fixture

**Smart Rotation**:
An organizer-controlled Club Session rule that proposes the next matches by considering eligible players, match counts, court availability, and pairing constraints.
_Avoid_: automatic tournament bracket, random queue

**Fairness gap**:
The difference between the highest and lowest match counts among eligible players in a Club Session.
_Avoid_: ranking gap, win-rate gap

**Pairing mode**:
The Club Session rule that determines whether doubles teams are open or must follow Mixed doubles composition.
_Avoid_: gender filter

**Availability**:
A Club Session player's current participation state: available, late, resting, or unavailable.
_Avoid_: account status, match status
