# Player guide

This guide describes the current V1.0 product scope. The app labels are in English by default and Indonesian is available from the language control.

## Start a match

1. Choose Badminton or Pickleball. V1.0 supports doubles for both sports.
2. Choose Casual or Referee. The current app stores and displays this choice, but both modes use the same match controls. Do not expect different scoring behavior yet.
3. Continue to setup. Choose Official Rules, a published Community Rule, or guest custom rules when that option is available.
4. Enter player names if you want them on this device. Choose which player serves first.
5. Start the match.

## Choose a ruleset

- Official Rules are locked in the app and follow the federation source listed in [rules-sources.md](rules-sources.md).
- Community Rules are made by other users. They are unofficial. Check the rule description with your group before play.
- Guest custom rules let a guest change the scoring settings supported by the selected sport. They apply only to that guest match, stay in the browser, and are discarded when the match ends.

The app keeps the selected ruleset with the match on the device where it was started. Editing a Community Rule creates a new published version. A match already in progress continues with the version it started with on that device.

## Keep score

- Tap the point or rally control for the team that won it. The app updates the score, serving side, and court positions according to the selected ruleset.
- Use Undo to reverse the last scoring action. Use Redo to restore an action that was undone.
- Use Score Correction when the displayed points are already wrong. Enter both team totals and apply the override. The app records one correction event and recalculates the state from those totals.
- Check the court display before the next serve. It shows which side is serving and where the players should stand.
- A match is marked complete automatically when the selected ruleset's match conditions are met. To leave early, or clear the finished match from this device, use End session in the match controls. This removes the device copy and revokes its Live Viewer link. A guest's server copy remains until expiry; account history remains saved.

Pickleball doubles uses a three-number score call. The opening sequence has a special second-server value. The app shows the serving team and server number so players can follow the selected ruleset.

## Guest matches and sync

Guests can start a match without Google sign-in. The browser keeps a local match journal and generates its match and event IDs. If Supabase is configured and the guest session is available, the app syncs the match to the server and retries failed syncs with the same IDs.

Guest matches remain available for up to 12 hours after the last accepted activity. If the app shows that a match is local or offline, keep the browser data and reconnect before relying on server sync. Clearing the site's browser data can remove the local copy.

One browser tab controls a match at a time. Other tabs for that match are read-only until control is available.

## Share a Live Viewer

1. Open the match sharing controls and create a Live Viewer link.
2. Send the link to people who should see the match. They do not need an account.
3. Viewers can see the score and court display, but cannot change the match.
4. Revoke the link from the match controls when it should stop working.

Anyone who gets the link can view the match until the link expires or the owner revokes it. Do not post a link publicly unless you intend the score and court display to be public. The link expires no later than the match data.

## Account history

Google sign-in is optional for playing. It enables account history and Community Rules management. Linking Google to the current guest session can claim still-valid guest matches.

The history page shows saved match summaries. Full match details are available on a device that still has that match's local journal. The current history page does not restore a full match journal onto a new device.

## Community Rules

Anyone can read published Community Rules. A Google-linked account can create, edit, publish, or unpublish its own rules. Use the share action or QR code on a rule page to send it to a group. You can report a published rule from its detail page.

Community Rules are unofficial and are not reviewed before publication. Check the scoring setup before applying one. See [community-rules-policy.md](community-rules-policy.md) for the current policy draft.

## If something looks wrong

- If a match is offline, restore the connection and check the sync status before closing the browser.
- If a Live Viewer stops updating, ask the match owner to check their connection or create a new link if the old one expired or was revoked.
- If the court position or server indicator looks wrong, pause scoring and use Score Correction only after confirming the score. Report the sport, selected ruleset, score, and steps that led to the issue.
- For a Community Rule concern, submit a report from the rule page. A report does not currently hide the rule automatically.
