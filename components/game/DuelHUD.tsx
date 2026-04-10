"use client";

import Image from "next/image";
import { DUEL_HEAT_MAX } from "@/lib/game/duel-heat";
import { OPPONENTS } from "@/lib/game/opponents";

interface Props {
  playerName: string;
  playerHp: number;
  playerAvatarUrl: string | null;
  bossIndex: number;
  bossHp: number;
  chopShieldHp: number;
  /** Player-only combo heat gauge (same chrome as HP bar, smaller). */
  duelHeat: number;
  /** When set and gauge is full, heat bar opens combo sequence (tap / keyboard). */
  onHeatBarActivate?: () => void;
  questionsInDuel: number;
  remain: number;
}

export function DuelHUD({
  playerName,
  playerHp,
  playerAvatarUrl,
  bossIndex,
  bossHp,
  chopShieldHp,
  duelHeat,
  onHeatBarActivate,
  questionsInDuel,
  remain,
}: Props) {
  const boss = OPPONENTS[bossIndex] ?? OPPONENTS[0]!;
  const playerPct = Math.min(100, Math.round((playerHp / 100) * 100));
  const bossPct =
    boss.maxHp > 0
      ? Math.min(100, Math.round((bossHp / boss.maxHp) * 100))
      : 0;
  const chopShieldPct = Math.min(100, Math.round((chopShieldHp / 50) * 100));
  const heatPct = Math.min(100, Math.round((duelHeat / DUEL_HEAT_MAX) * 100));
  const heatFull = duelHeat >= DUEL_HEAT_MAX;
  const heatInteractive = Boolean(heatFull && onHeatBarActivate);

  const timerClass = [
    "duel-hud-timer",
    remain <= 5
      ? "duel-hud-timer--danger"
      : remain <= 15
        ? "duel-hud-timer--warning"
        : "",
  ]
    .filter(Boolean)
    .join(" ");

  const announceText =
    remain === 10
      ? "10 seconds remaining"
      : remain === 5
        ? "5 seconds remaining"
        : null;

  return (
    <div className="duel-hud-wrap">
      <div className="duel-hud-row">
        <div className="duel-hud-fighter duel-hud-fighter--player">
          {playerAvatarUrl ? (
            <Image
              src={playerAvatarUrl}
              alt=""
              width={32}
              height={32}
              className="duel-hud-avatar"
              unoptimized
            />
          ) : (
            <span className="duel-hud-avatar-glyph" aria-hidden>
              ◈
            </span>
          )}
          <div className="duel-hud-info">
            <span className="duel-hud-name">{playerName}</span>
            <div
              className="duel-hud-hp-bar"
              role="progressbar"
              aria-label="Player health"
              aria-valuenow={playerHp}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="duel-hud-hp-fill duel-hud-hp-fill--player"
                style={{ width: `${playerPct}%` }}
              />
            </div>
            {heatInteractive ? (
              <button
                type="button"
                className="duel-hud-heat-bar duel-hud-heat-bar--interactive"
                aria-label="Combo ready — open combo sequence"
                onClick={onHeatBarActivate}
              >
                <span
                  className="duel-hud-heat-fill"
                  style={{ width: `${heatPct}%` }}
                  aria-hidden
                />
              </button>
            ) : (
              <div
                className="duel-hud-heat-bar"
                role="progressbar"
                aria-label="Combo heat gauge"
                aria-valuenow={duelHeat}
                aria-valuemin={0}
                aria-valuemax={DUEL_HEAT_MAX}
              >
                <div className="duel-hud-heat-fill" style={{ width: `${heatPct}%` }} />
              </div>
            )}
          </div>
        </div>

        <div className={timerClass} aria-hidden>
          {remain}
        </div>
        {announceText && (
          <span className="duel-hud-timer-announce" aria-live="polite" aria-atomic="true">
            {announceText}
          </span>
        )}

        <div className="duel-hud-fighter duel-hud-fighter--boss">
          <div className="duel-hud-info">
            <span className="duel-hud-name">{boss.displayName}</span>
            <div
              className="duel-hud-hp-bar duel-hud-hp-bar--boss"
              role="progressbar"
              aria-label={`${boss.displayName} health`}
              aria-valuenow={bossHp}
              aria-valuemin={0}
              aria-valuemax={boss.maxHp}
            >
              <div
                className="duel-hud-hp-fill duel-hud-hp-fill--boss"
                style={{ width: `${bossPct}%` }}
              />
            </div>
            {bossIndex === 2 && chopShieldHp > 0 && (
              <div
                className="duel-hud-shield-bar"
                role="progressbar"
                aria-label="Chop shield"
                aria-valuenow={chopShieldHp}
                aria-valuemin={0}
                aria-valuemax={50}
              >
                <div
                  className="duel-hud-shield-fill"
                  style={{ width: `${chopShieldPct}%` }}
                />
              </div>
            )}
          </div>
          <Image
            src={boss.image}
            alt={boss.displayName}
            width={32}
            height={32}
            className="duel-hud-avatar"
            unoptimized
          />
        </div>
      </div>

    </div>
  );
}
