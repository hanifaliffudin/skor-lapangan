# Smart Rotation pilot checklist

Status: ready for a club organizer to run in Supabase Preview.

This is a short, observable pilot script for one badminton club session. It is not a production sign-off. Use a disposable account linked through an enabled OAuth provider and a roster whose players have agreed that their display names and optional gender/skill metadata will be used privately by the organizer.

## Before the session

Record:

- Preview URL, date, browser, phone/desktop model, organizer, and migration version.
- Number of active courts and the real roster size.
- Whether the session is Open or Mixed doubles.
- Any players who arrive late, need a rest turn, or do not show.

Prepare these cases without creating public viewer links:

1. Four eligible players, one free court.
2. Five eligible players, one free court.
3. Eight eligible players, two courts, with one court already occupied.
4. Mixed mode with two men and two women.
5. Mixed mode with an uneven roster, then one player marked late/resting/unavailable.

## Run of show

1. Create a Club Session and choose the intended pairing mode.
2. Add the roster and at least one court. Set optional gender and skill only when the organizer has a real reason to use them.
3. Set one player to `late`, one to `resting`, and one to `unavailable`. Confirm Smart Rotation excludes all three. Treat a no-show as `unavailable`; the MVP does not auto-substitute without organizer confirmation.
4. Start one match on Court 1, leave Court 2 free, then request the next rotation. Confirm only Court 2 is proposed and no player in the unfinished match is reused.
5. Review the proposal before confirming it. Confirm the board explains match counts, fairness gap, pairing/repetition metrics, and skill gap.
6. Reject one proposal. Confirm no queue entry is added.
7. Change a player's availability or add a manual queue assignment in a second tab/device before confirming a previously opened proposal. Confirm the stale proposal is cancelled and the organizer must create a fresh preview.
8. In Mixed mode with no valid composition, confirm the board asks for an explicit Open fallback. Confirm the saved queue row is visibly marked as an Open fallback.
9. Add one manual assignment that is valid for the session. Confirm later Smart Rotation does not rewrite it.
10. Complete at least two matches and confirm the session records use completed, synced results; incomplete or unsynced results must not appear as wins.

## Mobile and keyboard pass

- Repeat steps 4–8 at a narrow phone width and a tablet width.
- Confirm there is no horizontal scroll, clipped proposal text, or control below a 44px touch target.
- Use Tab/Shift+Tab to reach the Smart Rotation, confirm, reject, fallback, roster, and availability controls. Confirm focus is visible and the result/error is announced.
- Switch the interface to Indonesian and English. Confirm the proposal metrics remain readable and do not overlap.

## Success criteria

The pilot passes when the organizer can run the session without a paper rotation list, can explain why the next players were chosen, makes no duplicate player/court assignments, and can recover from a late arrival, rest turn, no-show, manual override, and changed preview.

Record these observations rather than inventing a score:

| Observation                                          | Result / note |
| ---------------------------------------------------- | ------------- |
| Number of manual corrections                         |               |
| Players who felt they played too often or too little |               |
| Number of rejected proposals                         |               |
| Number of stale proposals recovered                  |               |
| Any gender/skill metadata concern                    |               |
| Any mobile/keyboard problem                          |               |
| Organizer's clearest improvement request             |               |

The pilot owner should attach the completed table to the release issue. Do not promote to production until Preview evidence, privacy review, and owner approval are recorded.
