import { OPPONENTS, MAX_QUESTIONS_PER_DUEL } from "./opponents";
import {
  getQuestionById,
  pickNextQuestion,
  pickRandomTf,
  toClientQuestion,
  gradeAnswer,
} from "./question-bank";
import { pointsForAnswer, bossClearBonus, hpEndOfDuelBonus } from "./scoring";
import type { GameSession, AnswerLogEntry } from "./types";

export function createLobbySession(id: string): GameSession {
  return {
    id,
    createdAt: Date.now(),
    walletAddress: null,
    twitterHandle: null,
    displayName: null,
    avatarUrl: null,
    phase: "lobby",
    bossIndex: 0,
    questionsInDuel: 0,
    playerHp: 100,
    oppHp: OPPONENTS[0]!.maxHp,
    suddenDeath: false,
    awaitingSuddenDeath: false,
    judgementUsed: false,
    boosters: [],
    issuedThisDuel: [],
    currentQuestion: null,
    currentQuestionAnswer: null,
    answerLog: [],
    powerUpsUsed: 0,
    bossesReached: 1,
    bossesDefeated: 0,
    runScore: 0,
    wrongCount: 0,
    topicMissCounts: {},
    shownAtMs: null,
    activeFoolNext: false,
    activeStrengthNext: false,
    pendingWorldAuto: false,
  };
}

export function startRun(session: GameSession, boosterIndices: number[]): GameSession {
  const next = { ...session, phase: "running" as const };
  next.boosters = boosterIndices.map((majorIndex) => ({ majorIndex, used: false }));
  next.bossIndex = 0;
  next.questionsInDuel = 0;
  next.playerHp = 100;
  next.oppHp = OPPONENTS[0]!.maxHp;
  next.issuedThisDuel = [];
  next.suddenDeath = false;
  next.awaitingSuddenDeath = false;
  next.judgementUsed = false;
  next.answerLog = [];
  next.runScore = 0;
  next.wrongCount = 0;
  next.topicMissCounts = {};
  next.bossesDefeated = 0;
  next.bossesReached = 1;
  next.powerUpsUsed = 0;
  next.activeFoolNext = false;
  next.activeStrengthNext = false;
  next.pendingWorldAuto = false;
  return dealNextQuestion(next);
}

function opp(session: GameSession) {
  return OPPONENTS[session.bossIndex] ?? OPPONENTS[0]!;
}

function dealNextQuestion(session: GameSession): GameSession {
  const q = pickNextQuestion(session.bossIndex, session.issuedThisDuel);
  if (!q) {
    return { ...session, currentQuestion: null, currentQuestionAnswer: null, shownAtMs: null };
  }
  const bank = getQuestionById(q.id);
  if (!bank) {
    return { ...session, currentQuestion: null, currentQuestionAnswer: null, shownAtMs: null };
  }
  return {
    ...session,
    issuedThisDuel: [...session.issuedThisDuel, q.id],
    currentQuestion: toClientQuestion(bank),
    currentQuestionAnswer: {
      bool: bank.answerBool,
      index: bank.correctIndex,
    },
    shownAtMs: Date.now(),
  };
}

function addLog(
  session: GameSession,
  qid: string,
  correct: boolean,
  latencyMs: number,
  kind: AnswerLogEntry["scoreKind"],
): GameSession {
  const entry: AnswerLogEntry = {
    questionId: qid,
    correct,
    bossIndex: session.bossIndex,
    latencyMs,
    scoreKind: kind,
  };
  const delta = pointsForAnswer(session.bossIndex, kind, correct);
  return {
    ...session,
    answerLog: [...session.answerLog, entry],
    runScore: Math.max(0, session.runScore + delta),
    wrongCount: correct ? session.wrongCount : session.wrongCount + 1,
  };
}

function winDuel(session: GameSession, hpSnapshot: number): GameSession {
  let s = {
    ...session,
    runScore: session.runScore + bossClearBonus() + hpEndOfDuelBonus(hpSnapshot),
    bossesDefeated: session.bossesDefeated + 1,
    questionsInDuel: 0,
    issuedThisDuel: [],
    suddenDeath: false,
    awaitingSuddenDeath: false,
  };
  if (s.bossIndex >= 2) {
    s.phase = "ended";
    s.currentQuestion = null;
    s.currentQuestionAnswer = null;
    s.shownAtMs = null;
    return s;
  }
  s = {
    ...s,
    bossIndex: s.bossIndex + 1,
    bossesReached: Math.max(s.bossesReached, s.bossIndex + 2),
    playerHp: 100,
    oppHp: OPPONENTS[s.bossIndex]!.maxHp,
  };
  return dealNextQuestion(s);
}

function loseSession(session: GameSession): GameSession {
  return {
    ...session,
    phase: "ended",
    currentQuestion: null,
    currentQuestionAnswer: null,
    shownAtMs: null,
    suddenDeath: false,
    awaitingSuddenDeath: false,
  };
}

function applyCapAfterAnswer(s: GameSession): GameSession {
  if (s.questionsInDuel < MAX_QUESTIONS_PER_DUEL) return s;
  if (s.oppHp <= 0 || s.playerHp <= 0) return s;
  if (s.playerHp > s.oppHp) return winDuel(s, s.playerHp);
  if (s.playerHp < s.oppHp) return loseSession(s);
  const tf = pickRandomTf(s.issuedThisDuel);
  if (!tf) return loseSession(s);
  const bank = getQuestionById(tf.id);
  if (!bank) return loseSession(s);
  return {
    ...s,
    issuedThisDuel: [...s.issuedThisDuel, tf.id],
    currentQuestion: toClientQuestion(bank),
    currentQuestionAnswer: { bool: bank.answerBool, index: bank.correctIndex },
    shownAtMs: Date.now(),
    suddenDeath: true,
    awaitingSuddenDeath: true,
  };
}

export function submitAnswer(
  session: GameSession,
  boolChoice?: boolean,
  choiceIndex?: number,
): GameSession {
  if (session.phase !== "running" || !session.currentQuestion) return session;
  const qid = session.currentQuestion.id;
  const bank = getQuestionById(qid);
  if (!bank) return session;

  const latencyMs = session.shownAtMs ? Math.max(0, Date.now() - session.shownAtMs) : 0;

  if (session.awaitingSuddenDeath) {
    const correct = gradeAnswer(bank, boolChoice, choiceIndex);
    let s = addLog(session, qid, correct, latencyMs, "normal");
    if (!correct) {
      s.topicMissCounts[bank.topic] = (s.topicMissCounts[bank.topic] ?? 0) + 1;
    }
    s.questionsInDuel += 1;
    s.currentQuestion = null;
    s.currentQuestionAnswer = null;
    s.shownAtMs = null;
    s.awaitingSuddenDeath = false;
    s.suddenDeath = false;
    return correct ? winDuel(s, s.playerHp) : loseSession(s);
  }

  let s = { ...session };
  let correct = false;
  let kind: AnswerLogEntry["scoreKind"] = "normal";

  if (s.activeFoolNext) {
    correct = true;
    kind = "fool";
    s.activeFoolNext = false;
  } else if (s.pendingWorldAuto) {
    correct = true;
    kind = "world";
    s.pendingWorldAuto = false;
  } else {
    correct = gradeAnswer(bank, boolChoice, choiceIndex);
  }

  if (!correct) {
    s.topicMissCounts[bank.topic] = (s.topicMissCounts[bank.topic] ?? 0) + 1;
  }

  s = addLog(s, qid, correct, latencyMs, kind);

  const o = opp(s);
  if (correct) {
    s.oppHp = Math.max(0, s.oppHp - o.damageToOpponentOnCorrect);
  } else {
    let dmg = o.wrongDamageToPlayer;
    if (s.activeStrengthNext) {
      dmg = 0;
      s.activeStrengthNext = false;
    }
    s.playerHp = Math.max(0, s.playerHp - dmg);
  }

  s.questionsInDuel += 1;
  s.currentQuestion = null;
  s.currentQuestionAnswer = null;
  s.shownAtMs = null;

  if (s.playerHp <= 0 && !s.judgementUsed) {
    s.playerHp = 1;
    s.judgementUsed = true;
  } else if (s.playerHp <= 0) {
    return loseSession(s);
  }

  if (s.oppHp <= 0) {
    return winDuel(s, s.playerHp);
  }

  const capped = applyCapAfterAnswer(s);
  if (capped.phase === "ended") return capped;
  if (capped.currentQuestion) return capped;
  return dealNextQuestion(capped);
}

export function applyPowerUp(session: GameSession, slot: number): GameSession {
  if (session.phase !== "running") return session;
  const b = session.boosters[slot];
  if (!b || b.used) return session;
  const major = b.majorIndex;
  let s = {
    ...session,
    boosters: session.boosters.map((x, i) =>
      i === slot ? { ...x, used: true } : x,
    ),
    powerUpsUsed: session.powerUpsUsed + 1,
    runScore: Math.max(0, session.runScore - 30),
  };

  if (major === 0) s.activeFoolNext = true;
  else if (major === 8) s.activeStrengthNext = true;
  else if (major === 21) s.pendingWorldAuto = true;
  return s;
}
