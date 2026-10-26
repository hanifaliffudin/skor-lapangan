export type Sport =
  "badminton" | "pickleball" | "tennis" | "padel" | "table_tennis" | "squash";
export type MatchFormat = "singles" | "doubles" | "mixed_doubles";
export type MatchMode = "casual" | "referee";
export type TeamId = "A" | "B";
export type PlayerIndex = 0 | 1;
export type CourtSide = "left" | "right";
export type OfficialRulesetId =
  | "bwf-doubles-3x21-2025"
  | "usap-doubles-sideout-2026"
  | "bwf-singles-3x21-2025"
  | "usap-singles-sideout-2026"
  | "usap-singles-rally-2026"
  | "fip-padel-2026"
  | "club-padel-singles-2026"
  | "ittf-table-tennis-2022"
  | "wsf-squash-singles-2025"
  | "wsf-squash-doubles-2022";
export type RuleSource = "official" | "community" | "guest_custom";
export type RulesetSource = RuleSource | "local_variant";
export type ScoringMode = "rally" | "side_out";
export type BestOf = 1 | 3 | 5;
export type TennisGameScoring = "advantage" | "no_ad";
export type TennisSetScoring = "tiebreak" | "advantage";
export type TennisFinalSetScoring = TennisSetScoring | "match_tiebreak";
export type TennisGender = "woman" | "man";

export interface TennisRules {
  bestOf: 3 | 5;
  gameScoring: TennisGameScoring;
  setScoring: TennisSetScoring;
  finalSetScoring: TennisFinalSetScoring;
  matchTieBreakPoints: 7 | 10;
}

export interface TennisSetOrders {
  /** First and second server each time this pair enters the service rotation. */
  serviceOrder: Record<TeamId, readonly [PlayerIndex, PlayerIndex]>;
  /** Player who receives the first point from the deuce court. */
  deuceReceiver: Record<TeamId, PlayerIndex>;
}

export interface TennisCompletedSet {
  winner: TeamId;
  score: Record<TeamId, number>;
  tieBreakScore?: Record<TeamId, number>;
  matchTieBreak?: boolean;
}

export interface TennisMatchState {
  setNumber: number;
  setsWon: Record<TeamId, number>;
  gamesInSet: Record<TeamId, number>;
  pointScore: Record<TeamId, number>;
  advantage: TeamId | null;
  gamePointCount: number;
  tieBreakScore: Record<TeamId, number> | null;
  phase: "game" | "tiebreak" | "match_tiebreak";
  setOpeningServer: TeamId;
  setOrders: TennisSetOrders;
  serviceTurns: Record<TeamId, number>;
  tieBreakFirstServer: { team: TeamId; player: PlayerIndex } | null;
  tieBreakStartCourtEndsSwapped: boolean;
  noAdReceivingSide: CourtSide | null;
  awaitingSetOrders: boolean;
  courtEndsSwapped: boolean;
  completedSets: TennisCompletedSet[];
}

export type PadelGameScoring = "advantage" | "star_point" | "golden_point";
export type PadelSetScoring = "standard" | "mini";
export type PadelFinalSetScoring = "standard" | "advantage" | "match_tiebreak";
export type PadelGender = "woman" | "man";

export interface PadelRules {
  gameScoring: PadelGameScoring;
  setScoring: PadelSetScoring;
  finalSetScoring: PadelFinalSetScoring;
  matchTieBreakPoints: 7 | 10;
}

export interface TableTennisRules {
  bestOf: 3 | 5;
}

export interface TableTennisGameOrders {
  firstServer: { team: TeamId; player: PlayerIndex };
  firstReceiver: { team: TeamId; player: PlayerIndex };
}

export interface TableTennisMatchState {
  gameOrders: TableTennisGameOrders;
  currentReceiver: PlayerIndex;
  awaitingGameOrders: boolean;
  courtEndsSwapped: boolean;
  receivingOrderSwapped: boolean;
}

export interface SquashRules {
  bestOf: 3 | 5;
}

export interface SquashGameOrders {
  serviceOrder: Record<TeamId, readonly [PlayerIndex, PlayerIndex]>;
  receiverBySide: Record<TeamId, { left: PlayerIndex; right: PlayerIndex }>;
  openingServiceBox: CourtSide;
}

export interface SquashMatchState {
  gameOrders: SquashGameOrders;
  currentServiceBox: CourtSide | null;
  serviceBoxChoiceRequired: boolean;
  awaitingGameOrders: boolean;
  serviceRotationStartTeam: TeamId;
  serviceRotationIndex: 0 | 1 | 2 | 3;
}

export interface PadelSetOrders {
  serviceOrder: Record<TeamId, readonly [PlayerIndex, PlayerIndex]>;
  deuceReceiver: Record<TeamId, PlayerIndex>;
}

export interface PadelCompletedSet {
  winner: TeamId;
  score: Record<TeamId, number>;
  tieBreakScore?: Record<TeamId, number>;
  matchTieBreak?: boolean;
}

export interface PadelMatchState {
  gameScoring: PadelGameScoring;
  setNumber: number;
  setsWon: Record<TeamId, number>;
  gamesInSet: Record<TeamId, number>;
  pointScore: Record<TeamId, number>;
  advantage: TeamId | null;
  starDeuces: number;
  gamePointCount: number;
  tieBreakScore: Record<TeamId, number> | null;
  phase: "game" | "tiebreak" | "match_tiebreak";
  setOpeningServer: TeamId;
  setOrders: PadelSetOrders;
  serviceTurns: Record<TeamId, number>;
  tieBreakFirstServer: { team: TeamId; player: PlayerIndex } | null;
  tieBreakStartCourtEndsSwapped: boolean;
  decidingReceivingSide: CourtSide | null;
  awaitingSetOrders: boolean;
  courtEndsSwapped: boolean;
  completedSets: PadelCompletedSet[];
}

export interface ScoringRules {
  pointsToWin: number;
  winBy: number;
  maxPoints: number | null;
  bestOf: BestOf;
  scoringMode: ScoringMode;
  serversPerTurn: 1 | 2;
  openingServerNumber: 1 | 2;
}

export interface CommunityRuleConfiguration {
  schemaVersion: 2;
  scoring: ScoringRules;
  tennis?: TennisRules;
  padel?: PadelRules;
  tableTennis?: TableTennisRules;
  squash?: SquashRules;
}

export interface RulesetSnapshot {
  id: string;
  name: string;
  sport: Sport;
  format?: MatchFormat;
  source: RulesetSource;
  version: number;
  /** Organization that publishes or maintains the referenced rules. */
  federation?: string;
  /** Public source used to verify this snapshot. */
  sourceUrl?: string;
  /** Date on which the source was last checked, in ISO calendar format. */
  checkedAt?: string;
  /** Optional date from which this ruleset is intended to apply. */
  effectiveFrom?: string;
  configuration?: ScoringRules;
  tennisConfiguration?: TennisRules;
  padelConfiguration?: PadelRules;
  tableTennisConfiguration?: TableTennisRules;
  squashConfiguration?: SquashRules;
}

export interface TennisLocalRoles {
  A: readonly [TennisGender, TennisGender];
  B: readonly [TennisGender, TennisGender];
}

export interface PadelLocalRoles {
  A: readonly [PadelGender, PadelGender];
  B: readonly [PadelGender, PadelGender];
}

export interface Player {
  id: string;
  name: string;
}

export interface TeamDefinition {
  name: string;
  players: readonly [Player] | readonly [Player, Player];
}

export interface MatchDefinition {
  id: string;
  sport: Sport;
  /** Missing on matches saved before singles support; treat those as doubles. */
  format?: MatchFormat;
  rulesetId: string;
  ruleset?: RulesetSnapshot;
  mode: MatchMode;
  createdAt: string;
  teams: Record<TeamId, TeamDefinition>;
  initialServingTeam: TeamId;
  initialServingPlayer: PlayerIndex;
  /** Local-only mixed-doubles labels. Never include in shared viewer payloads. */
  tennisLocalRoles?: TennisLocalRoles;
  tennisSetOrders?: TennisSetOrders;
  /** Local-only mixed-doubles labels. Never include in shared viewer payloads. */
  padelLocalRoles?: PadelLocalRoles;
  padelSetOrders?: PadelSetOrders;
  tableTennisOrders?: TableTennisGameOrders;
  squashGameOrders?: SquashGameOrders;
}

export interface TeamPosition {
  left: PlayerIndex;
  right: PlayerIndex;
}

export interface MatchState {
  matchId: string;
  sport: Sport;
  /** Missing on saved states from before singles support; treat those as doubles. */
  format?: MatchFormat;
  gameNumber: number;
  gamesWon: Record<TeamId, number>;
  points: Record<TeamId, number>;
  servingTeam: TeamId;
  currentServer: PlayerIndex;
  serverNumber: 1 | 2 | null;
  positions: Record<TeamId, TeamPosition>;
  status: "active" | "complete";
  winner: TeamId | null;
  completedGames: Array<{ winner: TeamId; score: Record<TeamId, number> }>;
  tennis?: TennisMatchState;
  padel?: PadelMatchState;
  tableTennis?: TableTennisMatchState;
  squash?: SquashMatchState;
}

export function getMatchFormat(match: { format?: MatchFormat }): MatchFormat {
  return match.format ?? "doubles";
}

interface EventBase {
  id: string;
  matchId: string;
  clientSequence: number;
  createdAt: string;
}

export interface RallyAwardedEvent extends EventBase {
  type: "rally_awarded";
  team: TeamId;
}

export interface StateOverriddenEvent extends EventBase {
  type: "state_overridden";
  points: Record<TeamId, number>;
}

export interface TennisSetOrdersConfirmedEvent extends EventBase {
  type: "tennis_set_orders_confirmed";
  orders: TennisSetOrders;
}

export interface TennisDecidingSideSelectedEvent extends EventBase {
  type: "tennis_deciding_side_selected";
  side: CourtSide;
}

export interface TennisScoreOverriddenEvent extends EventBase {
  type: "tennis_score_overridden";
  pointScore: Record<TeamId, number>;
  advantage: TeamId | null;
  tieBreakScore: Record<TeamId, number> | null;
  gamePointCount: number;
}

export interface PadelSetOrdersConfirmedEvent extends EventBase {
  type: "padel_set_orders_confirmed";
  orders: PadelSetOrders;
}

export interface PadelDecidingSideSelectedEvent extends EventBase {
  type: "padel_deciding_side_selected";
  side: CourtSide;
}

export interface PadelScoreOverriddenEvent extends EventBase {
  type: "padel_score_overridden";
  pointScore: Record<TeamId, number>;
  advantage: TeamId | null;
  starDeuces: number;
  tieBreakScore: Record<TeamId, number> | null;
  gamePointCount: number;
}

export interface TableTennisGameOrdersConfirmedEvent extends EventBase {
  type: "table_tennis_game_orders_confirmed";
  orders: TableTennisGameOrders;
}

export interface SquashGameOrdersConfirmedEvent extends EventBase {
  type: "squash_game_orders_confirmed";
  orders: SquashGameOrders;
}

export interface SquashServiceBoxSelectedEvent extends EventBase {
  type: "squash_service_box_selected";
  side: CourtSide;
}

export type DomainEvent =
  | RallyAwardedEvent
  | StateOverriddenEvent
  | TennisSetOrdersConfirmedEvent
  | TennisDecidingSideSelectedEvent
  | TennisScoreOverriddenEvent
  | PadelSetOrdersConfirmedEvent
  | PadelDecidingSideSelectedEvent
  | PadelScoreOverriddenEvent
  | TableTennisGameOrdersConfirmedEvent
  | SquashGameOrdersConfirmedEvent
  | SquashServiceBoxSelectedEvent;

export interface UndoAppliedEvent extends EventBase {
  type: "undo_applied";
  targetEventId: string;
}

export interface RedoAppliedEvent extends EventBase {
  type: "redo_applied";
  targetEventId: string;
}

export type AuditEvent = UndoAppliedEvent | RedoAppliedEvent;
export type MatchEvent = DomainEvent | AuditEvent;

export interface MatchJournal {
  definition: MatchDefinition;
  events: MatchEvent[];
  finalState?: MatchState;
}

export interface JournalView {
  state: MatchState;
  canUndo: boolean;
  canRedo: boolean;
  appliedEventIds: string[];
  redoEventIds: string[];
}

export interface EventMetadata {
  id: string;
  createdAt: string;
}
