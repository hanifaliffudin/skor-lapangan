# Player guide

This guide describes the current product scope. The app labels are in English by default and Indonesian is available from the language control.

## Start a match

1. Choose a sport and format. Badminton and Pickleball offer Singles or Doubles; Tennis and Padel also offer Mixed doubles.
2. Continue to player setup. V1 has one match workflow (Casual); Referee mode is hidden until it offers meaningfully different controls.
3. For Badminton and Pickleball, choose Official Rules or guest custom rules. Tennis and Padel use event-announced scoring options in their setup.
4. Enter one player name per side for Singles or two for Doubles. Choose who serves first, then start the match. Pickleball Singles can use standard side-out scoring or rally scoring; side-out is selected by default.

For Tennis, use the event-announced 2026 ITF format. Setup supports best of three or five sets, advantage or no-ad games, tie-break or advantage sets, and a 7- or 10-point match tie-break by two in place of the deciding set. The defaults are best of three, advantage games, and a tie-break set at 6–6. In doubles, choose each pair's first server and deuce-court receiver. In Mixed doubles, assign one woman and one man to each team; those labels stay on this device. Before each later set, confirm or change the doubles orders.

For Padel doubles and mixed doubles, setup follows the 2026 FIP rules and the event-announced scoring method: Advantage, Star Point, or Golden Point. Select standard sets or mini-sets, then choose a standard tie-break set, an advantage final set, or a 7-/10-point match tie-break replacing the final set. The default is best of three sets with Advantage games and a standard tie-break set. Choose each pair's first server and deuce-court receiver; confirm or change the orders before each later set. At a Golden Point or Star Point in mixed doubles, the receiver must match the server's gender. Those role labels stay on the controlling device. Singles is a club variant because FIP does not define singles; the app labels its 6 × 20 m court and FIP-derived scoring as local, not FIP-approved.

## Choose a ruleset

- Official Rules are locked in the app and follow the federation source listed in [rules-sources.md](rules-sources.md).
- Community Rules are deferred to a later release and are not available in V1.0.
- Guest custom rules let a guest change the scoring settings supported by the selected sport. They apply only to that guest match, stay in the browser, and are discarded when the match ends.

The app keeps the selected ruleset with the match on the device where it was started. Guest custom rules apply only to that match and stay in the browser.

## Keep score

- Tap the point or rally control for the team that won it. The app updates the score, serving side, and court positions according to the selected ruleset.
- Use Undo to reverse the last scoring action. Use Redo to restore an action that was undone.
- Use Score Correction when the displayed points are already wrong. Enter both team totals and apply the override. The app records one correction event and recalculates the state from those totals.
- Check the court display before the next serve. It shows which side is serving and where the players should stand.
- A match is marked complete automatically when the selected ruleset's match conditions are met. To leave early, or clear the finished match from this device, use End session in the match controls. This removes the device copy and revokes its Live Viewer link. A guest's server copy remains until expiry.

Pickleball doubles uses a three-number score call. The opening sequence has a special second-server value. The app shows the serving team and server number so players can follow the selected ruleset. Pickleball singles has one server per side and does not use a server number.

Tennis shows points as Love, 15, 30, 40, and Ad; tie-break points appear as numbers. The app tracks the server, receiver, service court, and court-end changes. At a no-ad deciding point, the receiver selects a court side. In Mixed doubles the app limits that choice to the same-gender receiver required by the ITF rule. Padel shows game points, Advantage/Star/Golden status, and numeric tie-break scores, and tracks the server, receiver, and court-end changes. Players or officials decide who won a point and make all calls; the app records their scoring input. Tennis and Padel are scorekeeping only and do not track faults, lets, challenges, or referee decisions.

## Guest matches and sync

The browser keeps a local match journal and generates its match and event IDs. If Supabase is configured and the guest session is available, the app syncs the match to the server and retries failed syncs with the same IDs. Tennis and Padel rules remain snapshotted so later federation updates do not change a match already in progress. Apply the Tennis and Padel scoring migrations before enabling those clients with Supabase.

The local copy remains available for up to 12 hours after the last local save. The server copy expires 12 hours after the last accepted server activity, capped at 24 hours from creation. Expired server data becomes inaccessible immediately and is physically deleted by an hourly cleanup job. If the app shows that a match is local or offline, keep the browser data and reconnect before relying on server sync. Clearing the site's browser data can remove the local copy.

One browser tab controls a match at a time. Other tabs for that match are read-only until control is available.

## Share a Live Viewer

1. Open the match sharing controls and create a Live Viewer link.
2. Send the link to people who should see the match. They do not need an account.
3. Viewers can see the score and court display, but cannot change the match.
4. Revoke the link from the match controls when it should stop working.

Anyone who gets the link can view the match until the link expires or the owner revokes it. It expires within 12 hours and no later than the match data; viewing does not extend it. Do not post a link publicly unless you intend the score and court display to be public.

## Features planned for a later release

Google account history and Community Rules are not available in V1.0. The app will add them only after the scoring and sync foundation passes its release gate.

## If something looks wrong

- If a match is offline, restore the connection and check the sync status before closing the browser.
- If a Live Viewer stops updating, ask the match owner to check their connection or create a new link if the old one expired or was revoked.
- If the court position or server indicator looks wrong, pause scoring and use Score Correction only after confirming the score. Tennis and Padel correction covers the active game or tie-break; Undo and Redo replay earlier scoring events. Report the sport, selected ruleset, score, and steps that led to the issue.
