# Official rules sources

Last verified: 2026-10-13.

## Squash

- Singles ruleset ID: `wsf-squash-singles-2025`
- Doubles ruleset ID: `wsf-squash-doubles-2022`
- Sources: [World Squash Singles Rules 2025](https://worldsquashofficiating.com/rules-of-squash/) and [International Doubles Squash Rules 2022](https://www.worldsquash.org/wp-content/uploads/2022/03/2022-International-Doubles-Squash-Rules-V2.pdf)
- Implemented: singles PARS games to 11, win by two; doubles games to 11 including 11–10; best-of-five by default with best-of-three available; rally winner scores and serves or hands over service. While serving, the service box alternates; after hand-out the new server chooses a box. Doubles keeps a fixed server order and records left/right receiver mappings per game.
- The app records only the winner of each rally. Let, stroke, fault, appeal, injury, referee calls, and other officiating workflows are outside scope.

## Table tennis

- Ruleset ID: `ittf-table-tennis-2022`
- Source: [ITTF Handbook 2022](https://db.ittf.com/sites/default/files/public/2022-02/ITTF_HB_2022_clean_v1_0.pdf)
- Implemented formats: singles and standard doubles. Games use 11 points, win by two, and matches use best of three or five games. Service changes every two points, then every point at 10–10. Doubles follows the ITTF server/receiver rotation; the deciding game changes ends and receiving order when one pair reaches five points.
- The first server is selected at setup. Doubles first receiver and each later game's order confirmation are recorded. The app records point winners and corrections but does not track expedites, lets, faults, officiating, or referee decisions.

## Padel

- Doubles and mixed-doubles ruleset ID: `fip-padel-2026`
- Source: [2026 FIP Rules of Padel](https://www.padelfip.com/wp-content/uploads/2025/12/FIP_Rules-of-Padel-1.pdf)
- Implemented: FIP doubles and mixed doubles on a 10 × 20 m court. Best of three sets, with Advantage, Star Point, or Golden Point games; standard or mini-sets before the deciding set; and a standard, advantage, or 7-/10-point match tie-break deciding set by two. The selected event format is snapshotted with each match.
- Doubles service and deuce-court receiver orders are selected per set. Mixed-doubles role labels stay on the controlling device; at a deciding point the receiver must match the server's gender under the FIP mixed-doubles rule. Service order, tie-break rotation, receiver position, and court-end changes follow the FIP rules.
- Club singles ruleset ID: `club-padel-singles-2026`. FIP does not define singles. This clearly labeled local variant uses a 6 × 20 m court and FIP-derived scoring; it is not an FIP format.
- The app records awarded points and corrections. Players or officials make all calls; officiating, faults, let decisions, challenges, and referee workflows are out of scope.

## Tennis

- Ruleset ID: `itf-tennis-2026`
- Source: [2026 ITF Rules of Tennis](https://www.itftennis.com/media/7221/2026-rules-of-tennis-english.pdf)
- Implemented formats: singles, standard doubles, and mixed doubles. Match options follow the event-announced format: best of three or five sets; advantage or no-ad games; tie-break or advantage sets, including the deciding set; or a 7-/10-point match tie-break by two in place of the deciding set.
- Defaults: best of three, advantage games, and a set tie-break at 6–6. No-ad deciding points let the receiver select the side, subject to the mixed-doubles same-gender receiver requirement.
- Doubles service and receiver orders are recorded at setup and may be confirmed or changed before each set. Tie-break service order, set-opening server, and court-end changes follow the ITF rules. Mixed-doubles role labels remain on the controlling device and are excluded from shared viewer data.
- The app records point winners and score corrections; players or officials make calls and determine the point winner. Short sets, short-set tie-breaks, no-let officiating, serve-fault tracking, and referee/challenge workflows are not supported.

## Badminton

- Singles ruleset ID: `bwf-singles-3x21-2025`
- Doubles ruleset ID: `bwf-doubles-3x21-2025`
- Source: [BWF Statutes, Section 4.1, Laws of Badminton](https://system.bwfbadminton.com/documents/folder_1_81/Statutes/CHAPTER-4---RULES-OF-THE-GAME/SECTION%204.1-%20Laws%20of%20Badminton.pdf)
- Implemented for singles and doubles: best of three games, 21 points, win by two, hard cap at 30, and rally scoring. Singles service court follows the server's score parity; doubles also rotates the serving player and court positions. The previous game winner serves first in the next game.

The BWF adopted a new 3x15 format in 2026, but its published effective date is 2027-01-04. The current v1 ruleset remains 3x21 until that date.

## Pickleball

- Doubles ruleset ID: `usap-doubles-sideout-2026`
- Source: [2026 USA Pickleball Official Rulebook](https://usapickleball.org/docs/rules/USAP-Official-Rulebook.pdf)
- Implemented: traditional side-out scoring, doubles score call with server number, 0-0-2 opening sequence, two servers before side-out after the opening sequence, game to 11 win by two, and best two of three games.

- Singles side-out ruleset ID: `usap-singles-sideout-2026`
- Singles rally ruleset ID: `usap-singles-rally-2026`
- Singles implementation: one server per side, service court based on the serving player's score parity, game to 11 win by two, and best two of three games. Side-out scoring is the default; rally scoring is an optional match setting.

The ruleset ID and match format are stored in every new match so future rule updates do not silently change how an older match is interpreted. Matches saved before format support are treated as doubles.
