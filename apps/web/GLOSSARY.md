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

**Club Session**:
An organizer-led open-play session that groups a roster, courts, a queue, and the Matches played during that session.
_Avoid_: Event, tournament

**Club Session Match**:
A Match planned within a Club Session, with its players, court, and queue position chosen before scoring begins.
_Avoid_: queued game, fixture
