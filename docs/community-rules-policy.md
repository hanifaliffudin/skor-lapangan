# Community Rules policy

**Status: V1.0 operating policy; public-facing legal terms still require owner and legal review.**

## What Community Rules are

Community Rules are user-created scoring configurations for Badminton or Pickleball. They are not federation rules. Every public rule must keep the app's unofficial label and use-at-your-own-risk notice.

Official Rules remain locked and maintained separately using the federation sources recorded in [rules-sources.md](rules-sources.md). A Community Rule must never be labeled or presented as Official Rules.

## Who can publish

- Anyone can read a published Community Rule without signing in.
- A Google-linked account can create, edit, publish, and unpublish rules it owns.
- The app publishes a rule immediately. It does not require pre-approval.
- A guest can make a custom ruleset for the current match only. Guest custom rules stay in that browser and are not uploaded or published.

## Rule content and limits

The current editor supports the scoring settings implemented for the two V1.0 sports. It does not accept arbitrary rule scripts.

- A title must contain 3 to 80 characters.
- A description can contain up to 500 characters.
- Each rule is associated with Badminton or Pickleball and a scoring configuration.
- Describe the format clearly. Include relevant local conditions or a source in the description when useful, but do not imply federation approval.

Do not publish content that impersonates a federation or official, contains private personal information, or is abusive, deceptive, or unrelated to scoring a game. The owner should review this proposed content standard before publishing it as a binding policy.

## Versions and match use

Saving an edit creates a new numbered Community Rule version. The detail page displays the current version. A match started from a rule keeps the selected configuration on the device where the match was created. Do not assume that a full match journal or ruleset snapshot can be restored on a different device.

Unpublishing removes the rule from public discovery and prevents new matches from selecting it. It does not delete stored rule versions or reports. A match already using a local copy can continue with that copy.

## Reporting and moderation

Anyone viewing a published rule can submit a report without Google sign-in. The app uses its guest session to rate-limit reports to three per hour per account. Reasons are inaccurate scoring, misleading, unsafe, spam, copyright or other rights, and other. Details can contain up to 500 characters. A reporter may optionally provide an email for follow-up. The system stores the rule ID, reason, details, time, reporter account ID, and optional email.

A report does not automatically hide a rule, and rules are not pre-approved before publication. Reports are manually reviewed by the service operator in the restricted Supabase SQL Editor queue. The operator should aim to review unsafe or rights-related reports within 48 hours and other reports within seven days; these are internal targets, not a guaranteed response time. A reviewer records the disposition and notes. A substantiated report may lead to a rule being unpublished; report volume alone is not a removal criterion. The app has no moderator dashboard, creator notification, or appeals interface. A reporter-provided email is for contacting the reporter, not the creator.

Use `open` and `reviewing` for pending reports, then `actioned` or `dismissed` for a reviewed report. Record outcomes as `no_action`, `requested_edit`, `unpublished`, or `removed`. Only use `requested_edit` when the operator has a real way to contact the creator. Unpublish rather than permanently delete when that sufficiently addresses the issue; reserve permanent removal for a deliberate operator decision. Removing a rule retains its reports without the rule link. Keep queue access restricted because reports may contain personal information. This process operates after publication and does not require approval of every rule.

## Sharing and responsibility

Published rules can be shared by URL or QR code. Anyone with access to the published page can read its title, description, sport, and current scoring configuration. A creator should review the rule before sharing it with a group and should unpublish it if it is no longer accurate.

Community Rules are used at the group's discretion. Players should confirm the settings with each other before starting a match and use Official Rules for federation-standard play.
