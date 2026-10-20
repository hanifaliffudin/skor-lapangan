# Scoring Core

This context defines the sport-agnostic scoring model and the sport-specific rules that derive a match state from an ordered event journal.

## Language

**Match**:
A scored sporting contest with two sides, a ruleset snapshot, and an ordered history of scoring events.
_Avoid_: Game, session

**Ruleset**:
The scoring configuration and sport rules selected when a Match starts.
_Avoid_: Settings, format

**Match state**:
The current derived score, service, player positions, and completion status produced from a Match definition and its events.
_Avoid_: Snapshot, score object

**Event journal**:
The ordered, append-only record of actions used to derive Match state, including scoring, corrections, and sport-specific order changes.
_Avoid_: History log, activity feed

**Team**:
One side of a Match, identified as A or B and containing one or two players according to the Match format.
_Avoid_: Pair, player group

**Service order**:
The declared sequence of players who serve for a doubles Team during the relevant game or set.
_Avoid_: Server list, rotation settings

**Match tie-break**:
A deciding tie-break that replaces the final set in Tennis or Padel when the selected Ruleset requires it.
_Avoid_: Super tie-break, final game
