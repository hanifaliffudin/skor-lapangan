# Official rules sources

Last verified: 2026-10-08.

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
