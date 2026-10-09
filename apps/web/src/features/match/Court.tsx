import {
  servingSide,
  type MatchDefinition,
  type MatchState,
  type TeamId,
} from "@skor-lapangan/scoring-core";
import { useLocale } from "../../lib/i18n";
import styles from "../../styles/App.module.css";

export function Court({
  definition,
  state,
}: {
  definition: MatchDefinition;
  state: MatchState;
}) {
  const { t } = useLocale();
  const side = servingSide(state);
  const serverName =
    definition.teams[state.servingTeam].players[state.currentServer].name;

  return (
    <section
      className={styles.courtPanel}
      aria-label={`${t("server")}: ${serverName}`}
    >
      <div className={styles.serviceCallout}>
        <span className={styles.liveDot} aria-hidden="true" />
        <strong>{serverName}</strong>
        <span>
          {t("serves")} · {t(side)}
        </span>
        {state.serverNumber ? (
          <span className={styles.serverBadge}>
            {t("server")} {state.serverNumber}
          </span>
        ) : null}
      </div>

      <div className={styles.court} data-sport={definition.sport}>
        <CourtHalf team="B" definition={definition} state={state} />
        <div className={styles.net} aria-hidden="true" />
        <CourtHalf team="A" definition={definition} state={state} />
      </div>
    </section>
  );
}

function CourtHalf({
  team,
  definition,
  state,
}: {
  team: TeamId;
  definition: MatchDefinition;
  state: MatchState;
}) {
  const position = state.positions[team];
  // Team B faces the opposite direction, so its local left/right is mirrored
  // when both halves are drawn from the same spectator viewpoint.
  const displaySides =
    team === "A" ? (["left", "right"] as const) : (["right", "left"] as const);
  return (
    <div className={styles.courtHalf} data-team={team}>
      {displaySides.map((side) => {
        const playerIndex = position[side];
        const player = definition.teams[team].players[playerIndex];
        const isServer =
          team === state.servingTeam && playerIndex === state.currentServer;
        return (
          <div
            className={styles.playerSpot}
            data-side={side}
            data-serving={isServer}
            key={`${team}-${side}`}
          >
            <span>{player.name}</span>
            {isServer ? <strong>S</strong> : null}
          </div>
        );
      })}
    </div>
  );
}
