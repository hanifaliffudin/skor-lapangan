# Club Session Smart Rotation

Status: Accepted MVP plan

## Problem

Open-play badminton sessions become unfair when the organizer has to build every match by hand. Players who arrive early may play repeatedly, late arrivals may be left out, and the same partners or opponents can meet all afternoon. A full round-robin schedule is also brittle because the roster changes while the session is running.

Smart Rotation chooses the next Club Session Match when a court becomes available. It keeps individual match counts close, respects the session's pairing rule, and leaves the organizer in control when the real-world situation does not fit the suggested match.

## Decisions

1. **Fairness unit**: fairness is based on match count, not minutes. A player's count includes completed matches and matches already started. The planner prefers a candidate set whose sorted match counts are lowest; the normal target is a maximum gap of one match among eligible players.
2. **Pairing preferences**: an organizer may mark a partner or opponent as an avoid preference. The planner treats this as a soft preference and avoids the pair when another valid candidate exists. Manual assignment always overrides it.
3. **Skill level**: each player has an optional club skill level from 1 to 5. Skill is a soft preference used to reduce team imbalance after fairness, pairing rules, and wait time have been considered.
4. **Mixed doubles imbalance**: a Mixed session requires one man and one woman in each team. If no valid mixed match exists, the organizer sees an explicit fallback and may choose Open doubles for that rotation. The planner never changes the session rule silently.
5. **Scheduling moment**: Smart Rotation plans the next match for each currently free active court. It does not pre-fill a complete schedule. The organizer can add or edit a manual queue entry at any time.

## Scope

### In scope

- A Club Session pairing mode: Open doubles or Mixed doubles.
- Optional player gender category, skill level, and availability state.
- A pure planner that selects one match per free court without reusing a player already queued or playing on another court.
- Fairness based on started/completed match counts.
- A reviewable explanation showing each selected player's current match count and the tie-breaker metrics used for the proposal.
- Court-side priority based on the longest wait when fairness is tied.
- Partner and opponent repetition penalties.
- Team skill balance as a soft tie-breaker.
- Manual queueing and manual organizer override.
- An explanation in the session board when no smart match can be made.

### Out of scope for this MVP

- Automatic payment, attendance billing, or shuttle-cost splitting.
- Player accounts, public rosters, or player statistics across sessions.
- Ranking skill levels from match results.
- Automatic substitution after a no-show without organizer confirmation.
- Tournament brackets and elimination rounds.
- Background notifications outside the open session board.

## Domain model

- **Eligible player**: an active roster player whose availability is `available` and who is not already assigned to an unfinished queue entry.
- **Fairness gap**: the difference between the highest and lowest match counts among eligible players.
- **Smart Rotation plan**: zero or more proposed Club Session Matches, one for each free active court, plus a reason when planning cannot continue.
- **Pairing mode**: `open` allows any valid doubles teams; `mixed` requires one man and one woman in each team.
- **Availability**: `available`, `late`, `resting`, or `unavailable`. Only `available` players are eligible. `late` is a visible roster state that becomes eligible after the organizer changes it.

## Planner order

The planner evaluates candidates in this order:

1. Valid session format and court availability.
2. Players who are active, available, and not already assigned.
3. Lowest sorted match-count vector.
4. Pairing mode validity.
5. Avoided partner/opponent pairs.
6. Longest wait since the player's last started match.
7. Repeated partner/opponent pairs.
8. Smallest team skill difference.
9. Stable roster order.

The planner may choose a less balanced skill matchup when that is the only way to keep play counts fair. It must never silently relax Mixed doubles into Open doubles.

## User flow

1. The organizer creates or opens a Club Session and chooses Open or Mixed doubles.
2. The organizer adds players, optionally sets gender category and skill level, and marks players late, resting, or unavailable as needed.
3. When one or more courts are free, the board shows `Fill next courts`.
4. The organizer reviews the proposed players and confirms the queue entries.
5. If Mixed doubles has no valid candidate, the board explains why and offers `Use Open doubles for this rotation` as an explicit action.
6. The organizer can still add a manual match. Manual matches count toward fairness history after they start.

## Acceptance criteria

### AC-1: Fair match count

- Given four eligible players with zero matches, when the organizer fills a court, then the planner selects those four players.
- Given eligible players with counts `0, 0, 1, 1, 2`, when one court is filled, then the planner includes the lowest-count players whenever four valid players exist.
- Given an active match on one court, when another court is filled, then players in the active match are not selected again.
- Given a queued but not-started match, when another court is filled, then players already assigned to that queue entry are not selected again.
- Given a proposed match, when the organizer reviews it, then the board shows the selected players' current match counts, fairness gap, avoid penalty, repetition penalty, and skill gap.

### AC-2: Courts and availability

- Given two active courts and one finished match, when the organizer fills next courts, then only the finished match's court is eligible for a new proposal if the other court is occupied.
- Given a player marked resting, late, or unavailable, when the organizer fills a court, then that player is excluded.
- Given fewer than four eligible players, when the organizer fills a court, then no match is inserted and the board explains the minimum requirement.

### AC-3: Mixed doubles

- Given Mixed mode and four eligible players with two men and two women, when a match is planned, then both teams contain one man and one woman.
- Given Mixed mode and no valid mixed combination, when the organizer requests a plan, then the planner returns an explicit fallback-required result and does not insert an Open match.
- Given the organizer confirms the fallback, when the next match is inserted, then that queue entry is marked as an Open fallback and the session history remains auditable.

### AC-4: Pairing and skill preferences

- Given two otherwise equal candidates, when one repeats a partner or opponent and the other does not, then the planner chooses the non-repeating candidate.
- Given an avoid preference and another valid candidate, when a match is planned, then the avoided pair is not used.
- Given two candidates with equal fairness and pairing scores, when one has a smaller team skill difference, then the planner chooses the smaller difference.

### AC-5: Manual control

- Given a manual queue assignment, when it is saved, then it remains unchanged by later Smart Rotation planning.
- Given a proposed Smart Rotation match, when the organizer rejects it, then no queue row is created.
- Given a proposed Smart Rotation match, when roster, availability, court state, or queue data changes before confirmation, then the proposal is rejected as stale and no queue row is created.
- Given a manual assignment that violates the session's Mixed rule, then the organizer receives a validation error unless the assignment is explicitly marked as an Open fallback.

### AC-6: Privacy and accessibility

- Gender, skill, availability, and avoid preferences are visible only to the signed-in organizer in the Club Session board.
- The Live Viewer and Display Mode never expose roster metadata from the Club Session.
- Every planner action is reachable by keyboard, has a visible result or error state, and keeps touch targets at least 44px.
- The roster and planner controls reflow without horizontal scrolling at phone and tablet widths.

## Delivery phases

### Phase 1: Planner seam

- Add the domain types and pure Smart Rotation planner.
- Add red tests for fairness, occupied courts, availability, Mixed validation, and tie-breakers.
- Replace full pre-generated schedule as the primary action with a next-court proposal while preserving manual queueing.

### Phase 2: Persistence and roster controls

- Persist pairing mode, player gender, skill level, availability, and avoid preferences.
- Add the organizer controls and explicit Mixed fallback confirmation.
- Add migration and RLS coverage.

### Phase 3: Preview verification

- Run mobile and keyboard checks on the session board.
- Verify the planner with 4, 5, 8, and uneven gender rosters.
- Verify manual override, late arrival, resting player, no-show, and multi-court flows in Preview.

## Success measure for the pilot

The organizer can run a session without maintaining a separate paper rotation list, and can explain why the next players were selected. Pilot feedback should focus on fairness, clarity, and the number of manual corrections rather than on a leaderboard score.
