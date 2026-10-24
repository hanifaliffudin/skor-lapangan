# Player guide

This guide describes the current product scope. The app labels are in English by default and Indonesian is available from the language control.

## Start a match

1. Choose a sport and format. Badminton, Pickleball, Table tennis, and Squash offer Singles or Doubles; Tennis and Padel also offer Mixed doubles.
2. Continue to player setup. V1 has one match workflow (Casual); Referee mode is hidden until it offers meaningfully different controls.
3. Choose Official Rules, a published Community Rule for the selected sport, or guest custom rules where available. Community Rules are available for Badminton, Pickleball, Tennis, Padel, Table tennis, and Squash; the setup still asks for server, receiver, service-box, and mixed-doubles role details locally.
4. Enter one player name per side for Singles or two for Doubles. Choose who serves first, then start the match. Pickleball Singles can use standard side-out scoring or rally scoring; side-out is selected by default.

For Tennis, use the event-announced 2026 ITF format. Setup supports best of three or five sets, advantage or no-ad games, tie-break or advantage sets, and a 7- or 10-point match tie-break by two in place of the deciding set. The defaults are best of three, advantage games, and a tie-break set at 6–6. In doubles, choose each pair's first server and deuce-court receiver. In Mixed doubles, assign one woman and one man to each team; those labels stay on this device. Before each later set, confirm or change the doubles orders.

For Padel doubles and mixed doubles, setup follows the 2026 FIP rules and the event-announced scoring method: Advantage, Star Point, or Golden Point. Select standard sets or mini-sets, then choose a standard tie-break set, an advantage final set, or a 7-/10-point match tie-break replacing the final set. The default is best of three sets with Advantage games and a standard tie-break set. Choose each pair's first server and deuce-court receiver; confirm or change the orders before each later set. At a Golden Point or Star Point in mixed doubles, the receiver must match the server's gender. Those role labels stay on the controlling device. Singles is a club variant because FIP does not define singles; the app labels its 6 × 20 m court and FIP-derived scoring as local, not FIP-approved.

For Table tennis, setup follows the ITTF 2022 rules. Choose best of three (the default) or best of five games, then select the first serving team. In doubles, choose the first server and first receiver. Each game is first to 11, win by two; service changes every two points and every point after 10–10. The app shows numeric game points, game wins, active server and receiver, and the doubles rotation on a portrait table. Before each later doubles game, confirm the next order. In the deciding game, court ends and receiving order switch when one pair reaches five points.

For Squash, setup follows the WSF singles 2025 and doubles 2022 rules. Best of five is the default; choose best of three when needed. Select the first serving team and service box. In doubles, choose each pair's fixed server order and left/right receiver mapping. Singles games use PARS to 11 and win by two; doubles games stop at 11–10. The active server alternates service boxes while retaining service, and chooses a box after hand-out. Before each new doubles game, confirm receiver mappings and the opening box. The court shows the front wall, tin, service line, short line, half-court line, service boxes, and server/receiver markers.

## Choose a ruleset

- Official Rules are locked in the app and follow the federation source listed in [rules-sources.md](rules-sources.md).
- Community Rules are user-published and always labeled unofficial. Open `/rules` to filter by sport, inspect a rule version, report a problem, or use it in setup. A Google-linked account can create, edit, publish, and unpublish its own rules.
- After unpublishing a rule, its owner can use **Republish** (or **Terbitkan lagi** in Indonesian) to make the same version public again without editing the settings or creating a new version.
- Guest custom rules let a guest change the scoring settings supported by the selected sport. They apply only to that guest match, stay in the browser, and are discarded when the match ends.

The app keeps a snapshot of the selected ruleset with the match on the device where it was started. Editing or unpublishing a Community Rule does not change an existing match. If a selected rule is unpublished, malformed, unavailable, or belongs to another sport, setup blocks the match until another ruleset is chosen.

## Keep score

- Tap the point or rally control for the team that won it. The app updates the score, serving side, and court positions according to the selected ruleset.
- Use Undo to reverse the last scoring action. Use Redo to restore an action that was undone.
- Use Score Correction when the displayed points are already wrong. Enter both team totals and apply the override. The app records one correction event and recalculates the state from those totals.
- Check the court display before the next serve. It shows which side is serving and where the players should stand.
- A match is marked complete automatically when the selected ruleset's match conditions are met. To leave early, or clear the finished match from this device, use End session in the match controls. This removes the device copy and revokes its Live Viewer link. A guest's server copy remains until expiry.

Pickleball doubles uses a three-number score call. The opening sequence has a special second-server value. The app shows the serving team and server number so players can follow the selected ruleset. Pickleball singles has one server per side and does not use a server number.

Tennis shows points as Love, 15, 30, 40, and Ad; tie-break points appear as numbers. The app tracks the server, receiver, service court, and court-end changes. At a no-ad deciding point, the receiver selects a court side. In Mixed doubles the app limits that choice to the same-gender receiver required by the ITF rule. Padel shows game points, Advantage/Star/Golden status, and numeric tie-break scores, and tracks the server, receiver, and court-end changes. Table tennis and Squash show numeric points and server/receiver markers. Players or officials decide who won a point and make all calls; the app records their scoring input. Tennis, Padel, Table tennis, and Squash are scorekeeping only and do not track faults, lets, challenges, or referee decisions.

## Guest matches and sync

The browser keeps a local match journal and generates its match and event IDs. If Supabase is configured and the guest session is available, the app syncs the match and event journal atomically, then retries failed syncs with the same IDs. A stale or divergent snapshot is rejected so it cannot silently overwrite the server. Tennis, Padel, Table tennis, and Squash rules remain snapshotted so later federation updates do not change a match already in progress. Apply the sport scoring migrations before enabling those clients with Supabase.

The local copy remains available for up to 12 hours after the last local save. The server copy expires 12 hours after the last accepted server activity, capped at 24 hours from creation. Expired server data becomes inaccessible immediately and is physically deleted by an hourly cleanup job. If the app shows that a match is local or offline, keep the browser data and reconnect before relying on server sync. Clearing the site's browser data can remove the local copy.

One browser tab or device controls an active match at a time. Other tabs and devices can load the latest server journal, but remain read-only until they acquire control. The control lease lasts 45 seconds and the editor renews it every 15 seconds. If another device is using the match, choose **Ambil alih match** or **Take over match** to replace its lease explicitly. The takeover first downloads the latest server version, so an unsynced local copy is never merged or written over the server silently. If control is lost, stop scoring and load the server version before continuing.

## Share a Live Viewer

1. Open the match sharing controls and create a Live Viewer link.
2. Send the link to people who should see the match. They do not need an account.
3. Viewers can see the score and court display, but cannot change the match.
4. Revoke the link from the match controls when it should stop working.

Anyone who gets the link can view the match until the link expires or the owner revokes it. It expires within 12 hours and no later than the match data; viewing does not extend it. Do not post a link publicly unless you intend the score and court display to be public.

## Accounts and history

Guests can play without an account. Guest matches remain local to the browser or device and do not support cross-device resume. Choose **Sign in with Google** to link an active guest session and keep eligible match history with the same account. Open **History** to see server-synced matches, grouped into **Berlangsung** and **Selesai**. An active match can be continued from another browser or device after its journal is downloaded. A completed match opens as read-only. Open **Account** to sign out or permanently delete the account and its stored data.

If the local and server versions have the same event sequence but different state, the app shows a conflict instead of choosing a version silently. Use **Gunakan versi server** or **Use server version** to discard the local branch and continue from the server snapshot, or choose **Simpan sebagai Match baru** / **Save as a new Match** to preserve the device version under a new Match ID without changing the server Match.

Community Rule reports are reviewed manually by the operator. Reporters can submit a reason, optional details, and optional contact email without Google sign-in; the system rate-limits anonymous reporting and never automatically hides a rule. Use Official Rules for federation-standard play.

## If something looks wrong

- If a match is offline, restore the connection and check the sync status before closing the browser.
- If a Live Viewer stops updating, ask the match owner to check their connection or create a new link if the old one expired or was revoked.
- If the court position or server/receiver indicator looks wrong, pause scoring and use Score Correction only after confirming the score. Tennis and Padel correction covers the active game or tie-break; Undo and Redo replay earlier scoring events. Report the sport, selected ruleset, score, and steps that led to the issue.
