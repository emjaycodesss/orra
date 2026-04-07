import type { GameSession } from "./types";

export const GAME_SESSION_COOKIE = "orra_game_session";

export function stripSecretAnswers(s: GameSession): Omit<GameSession, "currentQuestionAnswer"> {
  const { currentQuestionAnswer: _a, ...rest } = s;
  return rest;
}
