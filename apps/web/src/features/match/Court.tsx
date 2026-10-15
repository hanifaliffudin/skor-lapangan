import {
  getMatchFormat,
  servingSide,
  squashReceivingPlayer,
  padelReceivingPlayer,
  tableTennisReceivingPlayer,
  tennisReceivingPlayer,
  type CourtSide,
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
    definition.teams[state.servingTeam].players[state.currentServer]!.name;
  const receiverTeam = state.servingTeam === "A" ? "B" : "A";
  const receiverName =
    definition.sport === "table_tennis"
      ? definition.teams[receiverTeam].players[
          tableTennisReceivingPlayer(definition, state)
        ]?.name
      : definition.sport === "squash"
        ? definition.teams[receiverTeam].players[
            squashReceivingPlayer(definition, state) ?? 0
          ]?.name
        : null;

  return (
    <section
      className={styles.courtPanel}
      aria-label={`${t("server")}: ${serverName}`}
    >
      <div className={styles.serviceCallout}>
        <span className={styles.liveDot} aria-hidden="true" />
        <strong>{serverName}</strong>
        <span>
          {definition.sport === "table_tennis" || definition.sport === "squash"
            ? `${t("receives")}: ${receiverName ?? t(receiverTeam === "A" ? "teamA" : "teamB")}`
            : `${t("serves")} · ${t(side)}`}
        </span>
        {state.serverNumber ? (
          <span className={styles.serverBadge}>
            {t("server")} {state.serverNumber}
          </span>
        ) : null}
      </div>

      <div
        className={styles.court}
        data-sport={definition.sport}
        data-format={getMatchFormat(definition)}
        data-ends-swapped={
          state.tennis?.courtEndsSwapped ??
          state.padel?.courtEndsSwapped ??
          state.tableTennis?.courtEndsSwapped ??
          false
        }
      >
        <CourtHalf team="B" definition={definition} state={state} />
        {definition.sport !== "squash" ? (
          <div className={styles.net} aria-hidden="true" />
        ) : null}
        <CourtHalf team="A" definition={definition} state={state} />
      </div>
      {definition.sport === "table_tennis" || definition.sport === "squash" ? (
        <div
          className={styles.courtLegend}
          aria-label={`${t("courtMarkerServer")}; ${t("courtMarkerReceiver")}`}
        >
          <span>
            <strong aria-hidden="true">S</strong> {t("courtMarkerServer")}
          </span>
          <span>
            <strong aria-hidden="true">R</strong> {t("courtMarkerReceiver")}
          </span>
        </div>
      ) : null}
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
  const serviceSide = servingSide(state);
  const visibleSides =
    getMatchFormat(definition) === "singles"
      ? ([serviceSide] as CourtSide[])
      : displaySides;

  return (
    <div className={styles.courtHalf} data-team={team}>
      {visibleSides.map((side) => {
        const playerIndex =
          getMatchFormat(definition) === "singles"
            ? 0
            : definition.sport === "squash" && team === state.servingTeam
              ? side === serviceSide
                ? state.currentServer
                : (state.squash?.gameOrders.serviceOrder[team].find(
                    (player) => player !== state.currentServer,
                  ) ?? state.currentServer)
              : position[side];
        const player = definition.teams[team].players[playerIndex]!;
        const isServer =
          definition.sport !== "tennis" &&
          team === state.servingTeam &&
          playerIndex === state.currentServer &&
          (definition.sport !== "squash" || side === serviceSide);
        const isReceiver =
          (definition.sport === "tennis" ||
            definition.sport === "padel" ||
            definition.sport === "table_tennis" ||
            definition.sport === "squash") &&
          team !== state.servingTeam &&
          playerIndex ===
            (definition.sport === "tennis"
              ? tennisReceivingPlayer(definition, state, serviceSide)
              : definition.sport === "padel"
                ? padelReceivingPlayer(definition, state, serviceSide)
                : definition.sport === "table_tennis"
                  ? tableTennisReceivingPlayer(definition, state)
                  : squashReceivingPlayer(definition, state));
        return (
          <div
            className={styles.playerSpot}
            data-side={side}
            data-serving={isServer}
            data-receiving={isReceiver}
            style={{ gridColumn: displaySides.indexOf(side) + 1 }}
            key={`${team}-${side}`}
          >
            <span>{player.name}</span>
            {isServer ? (
              <strong>S</strong>
            ) : isReceiver ? (
              <strong>R</strong>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
