export type Sport = "badminton" | "pickleball";
export type MatchMode = "casual" | "referee";
export type TeamId = "A" | "B";
export type PlayerIndex = 0 | 1;
export type CourtSide = "left" | "right";
export type OfficialRulesetId =
  "bwf-doubles-3x21-2025" | "usap-doubles-sideout-2026";

export interface Player {
  id: string;
  name: string;
}

export interface TeamDefinition {
  name: string;
  players: readonly [Player, Player];
}

export interface MatchDefinition {
  id: string;
  sport: Sport;
  rulesetId: OfficialRulesetId;
  mode: MatchMode;
  createdAt: string;
  teams: Record<TeamId, TeamDefinition>;
  initialServingTeam: TeamId;
  initialServingPlayer: PlayerIndex;
}

export interface TeamPosition {
  left: PlayerIndex;
  right: PlayerIndex;
}

export interface MatchState {
  matchId: string;
  sport: Sport;
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

export type DomainEvent = RallyAwardedEvent | StateOverriddenEvent;

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
