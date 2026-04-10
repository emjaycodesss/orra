import { addDuelHeatAfterAnswer, DUEL_HEAT_MAX } from "./duel-heat";
import { OPPONENTS, MAX_QUESTIONS_PER_DUEL } from "./opponents";
import { QUESTION_BUDGET_SEC } from "./question-timer";
import { getQuestionById, pickNextQuestion, toClientQuestion } from "./question-bank";
import { pointsForAnswer, bossClearBonus, hpEndOfDuelBonus } from "./scoring";
import { findHighestTierSlot } from "./power-tier";
import type { GameSession, AnswerLogEntry, ClientQuestion } from "./types";
import { HIEROPHANT_ARMS_COPY } from "./hierophant-hint";

const BLANK_FLAGS = {
  activeFoolNext: false,
  activeMagicianReroll: false,
  activeHighPriestessNext: false,
  activeEmperorNext: false,
  activeHierophantNext: false,
  hierophantHint: null,
  activeLoversNext: false,
  activeChariotNext: false,
  activeStrengthNext: false,
  activeWheelNext: false,
  activeWheelAutoNext: false,
  activeJusticeNext: false,
  activeHangedManPeek: false,
  activeTemperanceNext: false,
  activeDevilRoundsLeft: 0,
  activeMoonNext: false,
  activeSunNext: false,
  pendingWorldAuto: false,
  lastWheelOutcome: null as GameSession["lastWheelOutcome"],
};

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** If Hierophant is armed but panel copy was lost (stale session / migration), restore the mechanical message. */
function ensureHierophantHint(session: GameSession): GameSession {
  if (!session.activeHierophantNext) return session;
  if (session.hierophantHint) return session;
  return { ...session, hierophantHint: HIEROPHANT_ARMS_COPY };
}

/** Slot + run score cost applied after we know the power-up can resolve (replacement cards pre-check first). */
function consumeBoosterSlot(session: GameSession, slot: number): GameSession {
  return {
    ...session,
    boosters: session.boosters.map((x, i) => (i === slot ? { ...x, used: true } : x)),
    powerUpsUsed: session.powerUpsUsed + 1,
    runScore: Math.max(0, session.runScore - 30),
  };
}

export function createLobbySession(id: string): GameSession {
  return {
    id,
    createdAt: Date.now(),
    revision: 0,
    walletAddress: null,
    twitterHandle: null,
    displayName: null,
    avatarUrl: null,
    phase: "lobby",
    bossIndex: 0,
    questionsInDuel: 0,
    playerHp: 100,
    oppHp: OPPONENTS[0]!.maxHp,
    chopShieldHp: 0,
    duelHeat: 0,
    suddenDeath: false,
    awaitingSuddenDeath: false,
    judgementUsed: false,
    boosters: [],
    issuedThisDuel: [],
    currentQuestion: null,
    currentQuestionAnswer: null,
    lastQuestion: null,
    lastAnswer: null,
    lastScoreDelta: null,
    lastPlayerHpDelta: null,
    lastBossHpDelta: null,
    lastAnswerAtMs: null,
    lastPowerUpFeedbackAtMs: null,
    answerLog: [],
    answerHistory: [],
    powerUpsUsed: 0,
    bossesReached: 1,
    bossesDefeated: 0,
    runScore: 0,
    wrongCount: 0,
    topicMissCounts: {},
    shownAtMs: null,
    aiQuestionMix: { seed: 0, live: 0 },
    aiRecentSeedFactIds: [],
    aiRecentBankQuestionIds: [],
    ...BLANK_FLAGS,
  };
}

export function startRun(session: GameSession, boosterIndices: number[]): GameSession {
  let s: GameSession = {
    ...session,
    phase: "running" as const,
    boosters: boosterIndices.map((majorIndex) => ({ majorIndex, used: false })),
    bossIndex: 0,
    questionsInDuel: 0,
    playerHp: 100,
    oppHp: OPPONENTS[0]!.maxHp,
    chopShieldHp: 0,
    duelHeat: 0,
    issuedThisDuel: [],
    suddenDeath: false,
    awaitingSuddenDeath: false,
    judgementUsed: false,
    answerLog: [],
    lastQuestion: null,
    lastAnswer: null,
    lastScoreDelta: null,
    lastPlayerHpDelta: null,
    lastBossHpDelta: null,
    lastAnswerAtMs: null,
    lastPowerUpFeedbackAtMs: null,
    runScore: 0,
    wrongCount: 0,
    topicMissCounts: {},
    bossesDefeated: 0,
    bossesReached: 1,
    powerUpsUsed: 0,
    answerHistory: [],
    aiQuestionMix: { seed: 0, live: 0 },
    aiRecentSeedFactIds: [],
    aiRecentBankQuestionIds: [],
    ...BLANK_FLAGS,
  };
  return dealNextQuestion(s);
}

function opp(session: GameSession) {
  return OPPONENTS[session.bossIndex] ?? OPPONENTS[0]!;
}

/**
 * Applies in-flight arcana decorations to the stem/options (e.g. High Priestess: MCQ elimination or TF lean).
 */
function decorateQuestionForActiveEffects(
  session: GameSession,
  clientQ: ClientQuestion,
  answer: { bool?: boolean; index?: number } | null,
): ClientQuestion {
  let nextQ = clientQ;

  if (session.activeHighPriestessNext && nextQ.type === "mcq" && nextQ.options) {
    const correctIdx = answer?.index ?? 0;
    const wrongIndices = nextQ.options.map((_, i) => i).filter((i) => i !== correctIdx);
    if (wrongIndices.length > 0) {
      nextQ = {
        ...nextQ,
        eliminatedIndex: wrongIndices[Math.floor(Math.random() * wrongIndices.length)],
      };
    }
  } else if (session.activeHighPriestessNext && nextQ.type === "tf" && answer?.bool !== undefined) {
    nextQ = {
      ...nextQ,
      tfLean: answer.bool ? "true" : "false",
    };
  }

  if (session.activeSunNext) {
    if (nextQ.type === "mcq" && typeof answer?.index === "number") {
      nextQ = { ...nextQ, sunCorrectIndex: answer.index };
    } else if (nextQ.type === "tf" && typeof answer?.bool === "boolean") {
      nextQ = { ...nextQ, sunCorrectBool: answer.bool };
    }
  }

  if (session.activeHierophantNext && session.hierophantHint) {
    nextQ = { ...nextQ, hierophantHint: session.hierophantHint };
  }

  if (session.activeMoonNext) {
    nextQ = { ...nextQ, stem: hideKeyword(nextQ.stem) };
  }

  return nextQ;
}

/** Build issued list for pool picks so we never redraw the current (or prior) stem. */
function issuedForPool(session: GameSession, extraIds: string[]): string[] {
  const out = [...session.issuedThisDuel];
  for (const id of extraIds) {
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * Pops one question using the same sources as dealNextQuestion: prepared queue for
 * `preparedBossKey`, then static bank. `extraIssuedIds` are excluded from the pool (e.g. current Q id).
 */
function takeReplacementQuestion(
  session: GameSession,
  params: {
    extraIssuedIds: string[];
    preparedBossKey: number;
    bankBossIndex: number;
    bankForceBossIndex?: number;
    forceType?: "tf" | "mcq";
  },
): {
  session: GameSession;
  clientQ: ClientQuestion;
  currentQuestionAnswer: { bool?: boolean; index?: number };
} | null {
  const issued = issuedForPool(session, params.extraIssuedIds);
  const preparedKey = String(params.preparedBossKey);
  const prepared = session.preGeneratedQuestionsByBoss?.[preparedKey] ?? [];
  const forceType = params.forceType;
  const preparedCandidate = prepared.find((q) => (forceType ? q.type === forceType : true));
  if (preparedCandidate) {
    const remainingPrepared = prepared.filter((q) => q.id !== preparedCandidate.id);
    const nextPreparedMap = {
      ...(session.preGeneratedQuestionsByBoss ?? {}),
      [preparedKey]: remainingPrepared,
    };
    const clientQBase: ClientQuestion = {
      id: preparedCandidate.id,
      type: preparedCandidate.type,
      stem: preparedCandidate.stem,
      options: preparedCandidate.type === "mcq" ? [...(preparedCandidate.options ?? [])] : undefined,
    };
    const currentQuestionAnswer =
      preparedCandidate.type === "tf"
        ? { bool: preparedCandidate.answerBool }
        : { index: preparedCandidate.correctIndex };
    const decorated = decorateQuestionForActiveEffects(session, clientQBase, currentQuestionAnswer);
    const nextIssued = [...issued];
    if (!nextIssued.includes(preparedCandidate.id)) nextIssued.push(preparedCandidate.id);
    return {
      session: {
        ...session,
        preGeneratedQuestionsByBoss: nextPreparedMap,
        issuedThisDuel: nextIssued,
      },
      clientQ: decorated,
      currentQuestionAnswer,
    };
  }

  const q = pickNextQuestion(params.bankBossIndex, issued, {
    forceType,
    forceBossIndex: params.bankForceBossIndex,
  });
  if (!q) return null;
  const bank = getQuestionById(q.id);
  if (!bank) return null;
  let clientQ = toClientQuestion(bank);
  const currentQuestionAnswer = { bool: bank.answerBool, index: bank.correctIndex };
  clientQ = decorateQuestionForActiveEffects(session, clientQ, currentQuestionAnswer);
  const nextIssued = [...issued];
  if (!nextIssued.includes(q.id)) nextIssued.push(q.id);
  return {
    session: {
      ...session,
      issuedThisDuel: nextIssued,
    },
    clientQ,
    currentQuestionAnswer,
  };
}

/**
 * Pulls prepared or bank question; clears Priestess/Sun/Justice one-shots on deal.
 * Moon stays active until the answer is graded (not cleared here).
 */
function dealNextQuestion(sessionIn: GameSession): GameSession {
  const session = ensureHierophantHint(sessionIn);
  const forceType = session.activeJusticeNext ? "tf" : undefined;
  const preparedKey = String(session.bossIndex);
  const prepared = session.preGeneratedQuestionsByBoss?.[preparedKey] ?? [];
  const preparedCandidate = prepared.find((q) => (forceType ? q.type === forceType : true));
  if (preparedCandidate) {
    const remainingPrepared = prepared.filter((q) => q.id !== preparedCandidate.id);
    const nextPreparedMap = {
      ...(session.preGeneratedQuestionsByBoss ?? {}),
      [preparedKey]: remainingPrepared,
    };
    const clientQ: ClientQuestion = {
      id: preparedCandidate.id,
      type: preparedCandidate.type,
      stem: preparedCandidate.stem,
      options: preparedCandidate.type === "mcq" ? [...(preparedCandidate.options ?? [])] : undefined,
    };
    const currentQuestionAnswer =
      preparedCandidate.type === "tf"
        ? { bool: preparedCandidate.answerBool }
        : { index: preparedCandidate.correctIndex };
    const decorated = decorateQuestionForActiveEffects(session, clientQ, currentQuestionAnswer);
    return {
      ...session,
      preGeneratedQuestionsByBoss: nextPreparedMap,
      issuedThisDuel: [...session.issuedThisDuel, preparedCandidate.id],
      currentQuestion: decorated,
      currentQuestionAnswer,
      shownAtMs: Date.now(),
      activeHighPriestessNext: false,
      activeSunNext: false,
      activeJusticeNext: false,
    };
  }

  const q = pickNextQuestion(session.bossIndex, session.issuedThisDuel, {
    forceType,
  });
  if (!q) {
    return { ...session, currentQuestion: null, currentQuestionAnswer: null, shownAtMs: null };
  }
  const bank = getQuestionById(q.id);
  if (!bank) {
    return { ...session, currentQuestion: null, currentQuestionAnswer: null, shownAtMs: null };
  }

  let clientQ = toClientQuestion(bank);
  const currentQuestionAnswer = { bool: bank.answerBool, index: bank.correctIndex };
  clientQ = decorateQuestionForActiveEffects(session, clientQ, currentQuestionAnswer);

  return {
    ...session,
    issuedThisDuel: [...session.issuedThisDuel, q.id],
    currentQuestion: clientQ,
    currentQuestionAnswer,
    shownAtMs: Date.now(),
    activeHighPriestessNext: false,
    activeSunNext: false,
    activeJusticeNext: false,
  };
}

/**
 * Replace the last meaningful word (len > 4) with `[???]` (Moon effect).
 * Prefers a contiguous alpha run so trailing punctuation stays attached; otherwise replaces the whole token.
 */
function hideKeyword(stem: string): string {
  const words = stem.split(" ");
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i]!;
    const alphaRun = w.match(/[A-Za-z]{5,}/)?.[0];
    if (alphaRun) {
      words[i] = w.replace(alphaRun, "[???]");
      return words.join(" ");
    }
    const lettersOnly = w.replace(/[^A-Za-z]/g, "");
    if (lettersOnly.length > 4) {
      words[i] = "[???]";
      return words.join(" ");
    }
  }
  if (words.length > 0) {
    const mid = Math.floor(words.length / 2);
    words[mid] = "[???]";
  }
  return words.join(" ");
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

/** Apply damage to boss, accounting for Chop's shield. Returns updated session. */
function applyBossDamage(session: GameSession, rawDamage: number): GameSession {
  let s = { ...session };
  if (s.bossIndex === 2 && s.chopShieldHp > 0) {
    const absorbed = Math.min(s.chopShieldHp, rawDamage);
    s.chopShieldHp = s.chopShieldHp - absorbed;
    rawDamage = rawDamage - absorbed;
  }
  s.oppHp = Math.max(0, s.oppHp - rawDamage);
  return s;
}

/** Apply true damage (bypasses Chop shield). */
function applyTrueDamage(session: GameSession, damage: number): GameSession {
  return { ...session, oppHp: Math.max(0, session.oppHp - damage) };
}

/** Lock the highest-tier booster for K.tizz duel. */
function applyKtizzLock(session: GameSession): GameSession {
  const slot = findHighestTierSlot(session.boosters);
  return {
    ...session,
    boosters: session.boosters.map((b, i) =>
      i === slot ? { ...b, locked: true } : b,
    ),
  };
}

/**
 * Awards duel clear, advances boss index or ends run, resets segment state, deals next question.
 * Entering boss index 1 applies {@link applyKtizzLock} (K.tizz forced booster lock).
 */
function winDuel(session: GameSession, hpSnapshot: number): GameSession {
  /** Single source of truth for runScore and HUD `lastScoreDelta` so clear bonuses stay aligned. */
  const duelEndScoreBonus = bossClearBonus() + hpEndOfDuelBonus(hpSnapshot);
  let s: GameSession = {
    ...session,
    runScore: session.runScore + duelEndScoreBonus,
    lastScoreDelta: (session.lastScoreDelta ?? 0) + duelEndScoreBonus,
    bossesDefeated: session.bossesDefeated + 1,
    questionsInDuel: 0,
    issuedThisDuel: [],
    suddenDeath: false,
    awaitingSuddenDeath: false,
    chopShieldHp: 0,
    duelHeat: 0,
    ...BLANK_FLAGS,
  };

  if (s.bossIndex >= 2) {
    s.phase = "ended";
    s.currentQuestion = null;
    s.currentQuestionAnswer = null;
    s.shownAtMs = null;
    return s;
  }

  const nextBossIndex = s.bossIndex + 1;
  s = {
    ...s,
    bossIndex: nextBossIndex,
    bossesReached: Math.max(s.bossesReached, nextBossIndex + 1),
    playerHp: 100,
    oppHp: OPPONENTS[nextBossIndex]!.maxHp,
    chopShieldHp: nextBossIndex === 2 ? 50 : 0,
    /** Judgement is one revive per guardian segment, not once for the whole run. */
    judgementUsed: false,
  };

  if (nextBossIndex === 1) {
    s = applyKtizzLock(s);
  }

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
    duelHeat: 0,
  };
}

/** Combo damage application result (helper output; not part of public session API). */
type ComboDamageResult = {
  oppHp: number;
  bossDefeated: boolean;
};

/** Minimal helper for fixed combo HP subtraction and defeat detection. */
export function applyComboDamage(input: {
  oppHp: number;
  comboDamageHp: number;
  bossMaxHp: number;
}): ComboDamageResult {
  const safeOppHp = Math.max(0, Math.min(input.bossMaxHp, input.oppHp));
  const safeComboDamage = Math.max(0, Math.floor(input.comboDamageHp));
  const nextOppHp = Math.max(0, safeOppHp - safeComboDamage);
  return {
    oppHp: nextOppHp,
    bossDefeated: nextOppHp <= 0,
  };
}

/**
 * Duel combo: valid only when duelHeat is full and the duel is still contested.
 * Applies damage through {@link applyBossDamage} (Chop shield absorbs before boss HP)
 * and only resolves the duel when boss HP reaches zero.
 */
export function applyDuelCombo(session: GameSession, comboDamageHp: number): GameSession {
  if (session.phase !== "running") return session;
  if (session.playerHp <= 0 || session.oppHp <= 0) return session;
  if ((session.duelHeat ?? 0) < DUEL_HEAT_MAX) return session;

  const damage = Math.max(0, Math.floor(comboDamageHp));
  let s = applyBossDamage({ ...session }, damage);
  const bossDefeated = s.oppHp <= 0;

  const next: GameSession = {
    ...s,
    duelHeat: 0,
    lastBossHpDelta: s.oppHp - session.oppHp,
    lastPlayerHpDelta: 0,
    lastScoreDelta: 0,
    lastPowerUpFeedbackAtMs: Date.now(),
  };
  return bossDefeated ? winDuel(next, next.playerHp) : next;
}

/**
 * After the soft question cap, keep playing until a real knockout (boss or player HP hits 0).
 * Previously we ended on HP comparison or tie sudden-death, which could "defeat" a guardian
 * who still had HP on the bar.
 */
function applyCapAfterAnswer(s: GameSession): GameSession {
  if (s.questionsInDuel < MAX_QUESTIONS_PER_DUEL) return s;
  if (s.oppHp <= 0 || s.playerHp <= 0) return s;
  return s;
}

/**
 * Grade the active question: arcana damage modifiers, Chop shield, heat, Judgement revive, next deal or end.
 * Sudden-death on Chop: wrong +25 shield (cap 50); correct chips shield first; shield can prevent lethal.
 * Fool/Wheel auto-correct skips boss chip; World still applies normal correct damage to the boss.
 * Emperor halves only the next wrong (survives correct answers). K.tizz unlocks a locked booster at ≤50 boss HP.
 * On Chop, Hierophant’s +5 uses {@link applyTrueDamage} (bypasses shield).
 */
export function submitAnswer(
  session: GameSession,
  boolChoice?: boolean,
  choiceIndex?: number,
): GameSession {
  if (session.phase !== "running" || !session.currentQuestion) return session;
  const qid = session.currentQuestion.id;
  const bank = getQuestionById(qid);

  const latencyMs = session.shownAtMs ? Math.max(0, Date.now() - session.shownAtMs) : 0;
  const scoreStart = session.runScore;
  const playerHpStart = session.playerHp;
  const bossHpStart = session.oppHp;
  const questionType = session.currentQuestion.type;
  const expectedBool = session.currentQuestionAnswer?.bool;
  const expectedIndex = session.currentQuestionAnswer?.index;
  const missTopic = bank?.topic ?? "ai-generated";
  const questionSource = bank ? "bank" : "prepared-or-runtime";

  const buildAnswerLabels = (isCorrect: boolean) => {
    const stem = session.currentQuestion?.stem ?? bank?.stem ?? "";
    if (questionType === "tf") {
      const correctLabel = expectedBool ? "True" : "False";
      const pickedLabel =
        typeof boolChoice === "boolean" ? (boolChoice ? "True" : "False") : "No answer";
      return { stem, correctLabel, pickedLabel, correct: isCorrect, type: "tf" as const };
    }
    const opts = session.currentQuestion?.options ?? bank?.options ?? [];
    const correctLabel =
      typeof expectedIndex === "number" && opts[expectedIndex]
        ? opts[expectedIndex]!
        : "Unknown";
    const pickedLabel =
      typeof choiceIndex === "number" && choiceIndex >= 0 && opts[choiceIndex]
        ? opts[choiceIndex]!
        : "No answer";
    return { stem, correctLabel, pickedLabel, correct: isCorrect, type: "mcq" as const };
  };

  if (session.awaitingSuddenDeath) {
    const sessionForTurn = { ...session, lastWheelOutcome: null as GameSession["lastWheelOutcome"] };
    const correct =
      questionType === "tf" ? boolChoice === expectedBool : choiceIndex === expectedIndex;
    const lastAnswer = {
      questionId: qid,
      correct,
      correctIndex: session.currentQuestionAnswer?.index,
      answerBool: session.currentQuestionAnswer?.bool,
      pickedIndex: choiceIndex,
      pickedBool: boolChoice,
      scoreKind: "normal" as const,
    };
    let s = addLog(sessionForTurn, qid, correct, latencyMs, "normal");
    if (!correct) {
      s.topicMissCounts[missTopic] = (s.topicMissCounts[missTopic] ?? 0) + 1;
    }
    s.questionsInDuel += 1;
    const labels = buildAnswerLabels(correct);
    s.currentQuestion = null;
    s.currentQuestionAnswer = null;
    s.lastQuestion = session.currentQuestion;
    s.lastAnswer = lastAnswer;
    s.lastScoreDelta = s.runScore - scoreStart;
    s.lastPlayerHpDelta = s.playerHp - playerHpStart;
    s.lastBossHpDelta = s.oppHp - bossHpStart;
    s.lastAnswerAtMs = Date.now();
    s.lastPowerUpFeedbackAtMs = null;
    s.answerHistory = (s.answerHistory ?? []).concat({
      questionId: qid,
      questionType: labels.type,
      stem: labels.stem,
      correct: labels.correct,
      correctLabel: labels.correctLabel,
      pickedLabel: labels.pickedLabel,
    });
    s.shownAtMs = null;
    s.awaitingSuddenDeath = false;
    s.suddenDeath = false;
    if (s.bossIndex === 2) {
      if (!correct) {
        s.chopShieldHp = Math.min(50, s.chopShieldHp + 25);
      } else {
        s = applyBossDamage(s, opp(s).damageToOpponentOnCorrect);
      }
    }
    if (!correct) {
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

  let s = { ...session, lastWheelOutcome: null as GameSession["lastWheelOutcome"] };
  let correct = false;
  let kind: AnswerLogEntry["scoreKind"] = "normal";

  if (s.activeFoolNext) {
    correct = true;
    kind = s.activeWheelAutoNext ? "wheel-auto" : "fool";
    s.activeFoolNext = false;
    s.activeWheelAutoNext = false;
  } else if (s.pendingWorldAuto) {
    correct = true;
    kind = "world";
    s.pendingWorldAuto = false;
  } else {
    correct =
      questionType === "tf" ? boolChoice === expectedBool : choiceIndex === expectedIndex;
  }

  if (!correct) {
    s.topicMissCounts[missTopic] = (s.topicMissCounts[missTopic] ?? 0) + 1;
  }

  s = addLog(s, qid, correct, latencyMs, kind);

  const o = opp(s);

  if (correct) {
    let bossDmg =
      kind === "fool" || kind === "wheel-auto" ? 0 : o.damageToOpponentOnCorrect;

    if (s.activeDevilRoundsLeft > 0) {
      bossDmg = Math.round(bossDmg * 1.5);
      s.activeDevilRoundsLeft = Math.max(0, s.activeDevilRoundsLeft - 1);
    }

    if (s.activeLoversNext) {
      bossDmg = bossDmg * 2;
      s.activeLoversNext = false;
    }

    if (s.activeWheelNext) {
      bossDmg = bossDmg * 2;
      s.activeWheelNext = false;
    }

    if (s.activeChariotNext) {
      bossDmg += 10;
      s.activeChariotNext = false;
    }

    let hierophantBonusToBoss = 0;
    if (s.activeHierophantNext) {
      hierophantBonusToBoss = 5;
      bossDmg += hierophantBonusToBoss;
      s.activeHierophantNext = false;
      s.hierophantHint = null;
    }

    if (s.activeMoonNext) {
      bossDmg += 20;
      s.activeMoonNext = false;
    }

    if (
      s.bossIndex === 0 &&
      latencyMs < 10_000 &&
      kind !== "fool" &&
      kind !== "wheel-auto" &&
      kind !== "world"
    ) {
      bossDmg += 5 * (s.bossIndex + 1);
    }

    if (s.bossIndex === 2) {
      if (hierophantBonusToBoss > 0) {
        const throughShield = Math.max(0, bossDmg - hierophantBonusToBoss);
        s = applyBossDamage(s, throughShield);
        s = applyTrueDamage(s, hierophantBonusToBoss);
      } else {
        s = applyBossDamage(s, bossDmg);
      }
    } else {
      s.oppHp = Math.max(0, s.oppHp - bossDmg);
    }

    s.activeTemperanceNext = false;
    s.activeHangedManPeek = false;
  } else {
    let dmg = o.wrongDamageToPlayer;

    if (s.activeStrengthNext) {
      dmg = 0;
      s.activeStrengthNext = false;
    }

    if (s.activeEmperorNext && dmg > 0) {
      dmg = Math.floor(dmg / 2);
      s.activeEmperorNext = false;
    }

    if (s.activeTemperanceNext && dmg > 0) {
      const half = Math.floor(dmg / 2);
      dmg = half;
      s = applyBossDamage(s, half);
      s.activeTemperanceNext = false;
    }

    if (s.activeLoversNext && dmg > 0) {
      dmg = dmg * 2;
      s.activeLoversNext = false;
    }

    if (s.activeWheelNext && dmg > 0) {
      dmg = dmg * 2;
      s.activeWheelNext = false;
    }

    if (s.activeChariotNext && dmg > 0) {
      dmg += 5;
      s.activeChariotNext = false;
    }

    if (s.activeDevilRoundsLeft > 0 && dmg > 0) {
      dmg = Math.round(dmg * 1.5);
      s.activeDevilRoundsLeft = Math.max(0, s.activeDevilRoundsLeft - 1);
    }

    s.activeHierophantNext = false;
    s.hierophantHint = null;
    s.activeMoonNext = false;
    s.activeHangedManPeek = false;

    if (s.bossIndex === 2) {
      s.chopShieldHp = Math.min(50, s.chopShieldHp + 25);
    }

    s.playerHp = Math.max(0, s.playerHp - dmg);

    if (s.bossIndex === 0 && latencyMs > 15_000) {
      const tickDmg = Math.floor((latencyMs - 15_000) / 3_000) * 2;
      s.playerHp = Math.max(0, s.playerHp - tickDmg);
    }
  }

  if (s.bossIndex === 1 && s.oppHp <= 50) {
    s.boosters = s.boosters.map((b) => (b.locked ? { ...b, locked: false } : b));
  }

  s.questionsInDuel += s.activeMagicianReroll ? 0 : 1;
  const labels = buildAnswerLabels(correct);
  s.currentQuestion = null;
  s.currentQuestionAnswer = null;
  s.lastQuestion = session.currentQuestion;
  s.lastAnswer = {
    questionId: qid,
    correct,
    correctIndex: session.currentQuestionAnswer?.index,
    answerBool: session.currentQuestionAnswer?.bool,
    pickedIndex: choiceIndex,
    pickedBool: boolChoice,
    scoreKind: kind,
  };
  s.lastScoreDelta = s.runScore - scoreStart;
  s.lastPlayerHpDelta = s.playerHp - playerHpStart;
  s.lastBossHpDelta = s.oppHp - bossHpStart;
  s.lastAnswerAtMs = Date.now();
  s.lastPowerUpFeedbackAtMs = null;
  s.answerHistory = (s.answerHistory ?? []).concat({
    questionId: qid,
    questionType: labels.type,
    stem: labels.stem,
    correct: labels.correct,
    correctLabel: labels.correctLabel,
    pickedLabel: labels.pickedLabel,
  });
  s.shownAtMs = null;
  s.activeMagicianReroll = false;

  s = addDuelHeatAfterAnswer(s, { correct, scoreKind: kind });

  /**
   * Judgement (Arcana XX): one emergency revive per guardian segment if the loadout includes it.
   * `Number(...)` tolerates rare JSON/pg hydration where major indices arrive as strings.
   * After revive, recompute `lastPlayerHpDelta` (it was derived at HP 0) so HUD/floaters match surviving HP.
   */
  const hasJudgementLoadout = s.boosters.some((b) => Number(b.majorIndex) === 20);
  if (s.playerHp <= 0 && !s.judgementUsed && hasJudgementLoadout) {
    s.playerHp = 1;
    s.judgementUsed = true;
    s.lastPlayerHpDelta = s.playerHp - playerHpStart;
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

function finalizePowerUpApply(
  before: GameSession,
  s: GameSession,
  slot: number,
  major: number,
): GameSession {
  let out = ensureHierophantHint(s);
  if (out.activeHierophantNext && out.hierophantHint && out.currentQuestion) {
    out = { ...out, currentQuestion: { ...out.currentQuestion, hierophantHint: out.hierophantHint } };
  }

  const lastBossHpDelta = out.oppHp - before.oppHp;
  const lastPlayerHpDelta = out.playerHp - before.playerHp;
  const lastScoreDelta = out.runScore - before.runScore;
  out = {
    ...out,
    lastBossHpDelta,
    lastPlayerHpDelta,
    lastScoreDelta,
    lastPowerUpFeedbackAtMs: Date.now(),
  };

  if (out.oppHp <= 0 && out.phase === "running") {
    return winDuel(out, out.playerHp);
  }

  return out;
}

/**
 * Consumes `slot` and applies its arcana. Judgement (XX) is passive — never consumes or scores here.
 * Hierophant: arms-themed stem; Wheel: immediate `lastWheelOutcome`; Hanged Man: `shownAtMs` shift (+10s feel);
 * Sun: pin MCQ/TF on stem or set `activeSunNext`.
 */
export function applyPowerUp(session: GameSession, slot: number): GameSession {
  if (session.phase !== "running") return session;
  const b = session.boosters[slot];
  if (!b || b.used || b.locked) return session;
  const major = b.majorIndex;
  if (major === 20) return session;

  /** Snapshot before slot consumption / card logic — used for HUD delta fields. */
  const before = session;

  if (major === 1) {
    const oldQid = session.currentQuestion?.id ? [session.currentQuestion.id] : [];
    const popped = takeReplacementQuestion(session, {
      extraIssuedIds: oldQid,
      preparedBossKey: session.bossIndex,
      bankBossIndex: session.bossIndex,
    });
    if (!popped) return session;
    let s = consumeBoosterSlot(session, slot);
    s = {
      ...popped.session,
      boosters: s.boosters,
      powerUpsUsed: s.powerUpsUsed,
      runScore: s.runScore,
      currentQuestion: popped.clientQ,
      currentQuestionAnswer: popped.currentQuestionAnswer,
      questionsInDuel: s.questionsInDuel + 1,
      activeMagicianReroll: true,
      shownAtMs: Date.now(),
    };
    return finalizePowerUpApply(before, s, slot, major);
  }

  if (major === 9) {
    const oldQid9 = session.currentQuestion?.id ? [session.currentQuestion.id] : [];
    const lowerBoss = Math.max(0, session.bossIndex - 1);
    const popped = takeReplacementQuestion(session, {
      extraIssuedIds: oldQid9,
      preparedBossKey: lowerBoss,
      bankBossIndex: session.bossIndex,
      bankForceBossIndex: lowerBoss,
    });
    if (!popped) return session;
    let s = consumeBoosterSlot(session, slot);
    s = {
      ...popped.session,
      boosters: s.boosters,
      powerUpsUsed: s.powerUpsUsed,
      runScore: s.runScore,
      currentQuestion: popped.clientQ,
      currentQuestionAnswer: popped.currentQuestionAnswer,
      shownAtMs: Date.now(),
    };
    return finalizePowerUpApply(before, s, slot, major);
  }

  if (major === 11) {
    const oldQid11 = session.currentQuestion?.id ? [session.currentQuestion.id] : [];
    const popped = takeReplacementQuestion(session, {
      extraIssuedIds: oldQid11,
      preparedBossKey: session.bossIndex,
      bankBossIndex: session.bossIndex,
      forceType: "tf",
    });
    if (!popped) return session;
    let s = consumeBoosterSlot(session, slot);
    s = {
      ...popped.session,
      boosters: s.boosters,
      powerUpsUsed: s.powerUpsUsed,
      runScore: s.runScore,
      currentQuestion: popped.clientQ,
      currentQuestionAnswer: popped.currentQuestionAnswer,
      questionsInDuel: s.questionsInDuel + 1,
      activeJusticeNext: false,
      shownAtMs: Date.now(),
    };
    return finalizePowerUpApply(before, s, slot, major);
  }

  let s: GameSession = consumeBoosterSlot(session, slot);

  switch (major) {
    case 0:
      s.activeFoolNext = true;
      break;

    case 2: {
      if (s.currentQuestion?.type === "mcq" && s.currentQuestionAnswer?.index !== undefined) {
        const correctIdx = s.currentQuestionAnswer.index;
        const opts = s.currentQuestion.options ?? [];
        const wrongIndices = opts.map((_, i) => i).filter((i) => i !== correctIdx);
        if (wrongIndices.length > 0) {
          const elimIdx = wrongIndices[Math.floor(Math.random() * wrongIndices.length)]!;
          s.currentQuestion = { ...s.currentQuestion, eliminatedIndex: elimIdx };
        }
      } else if (s.currentQuestion?.type === "tf" && s.currentQuestionAnswer?.bool !== undefined) {
        s.currentQuestion = {
          ...s.currentQuestion,
          tfLean: s.currentQuestionAnswer.bool ? "true" : "false",
        };
      } else {
        s.activeHighPriestessNext = true;
      }
      break;
    }

    case 3:
      s.playerHp = Math.min(100, s.playerHp + 20);
      break;

    case 4:
      s.activeEmperorNext = true;
      break;

    case 5: {
      s.activeHierophantNext = true;
      s.hierophantHint = HIEROPHANT_ARMS_COPY;
      if (s.currentQuestion) {
        s.currentQuestion = {
          ...s.currentQuestion,
          hierophantHint: HIEROPHANT_ARMS_COPY,
        };
      }
      break;
    }

    case 6:
      s.activeLoversNext = true;
      break;

    case 7:
      s.activeChariotNext = true;
      break;

    case 8:
      s.activeStrengthNext = true;
      break;

    case 10: {
      const roll = Math.random();
      if (roll < 0.25) {
        s.playerHp = Math.min(100, s.playerHp + 10);
        s.lastWheelOutcome = "wheel_heal10";
      } else if (roll < 0.5) {
        s.playerHp = Math.max(1, s.playerHp - 10);
        s.lastWheelOutcome = "wheel_hurt10";
      } else if (roll < 0.75) {
        s.activeFoolNext = true;
        s.activeWheelAutoNext = true;
        s.lastWheelOutcome = "wheel_free_skip";
      } else {
        s.activeWheelNext = true;
        s.lastWheelOutcome = "wheel_double_next";
      }
      break;
    }

    case 12: {
      s.playerHp = Math.max(1, s.playerHp - 5);
      s.activeHangedManPeek = true;
      const now = Date.now();
      if (s.currentQuestion && s.shownAtMs != null) {
        const elapsedSec = (now - s.shownAtMs) / 1000;
        const remainSec = Math.max(0, QUESTION_BUDGET_SEC - elapsedSec);
        const newRemainSec = remainSec + 10;
        s.shownAtMs = now - (QUESTION_BUDGET_SEC - newRemainSec) * 1000;
      } else {
        s.shownAtMs = now - (QUESTION_BUDGET_SEC - 10) * 1000;
      }
      break;
    }

    case 13:
      s = applyTrueDamage(s, 10);
      break;

    case 14:
      s.activeTemperanceNext = true;
      break;

    case 15:
      s.activeDevilRoundsLeft = 2;
      break;

    case 16:
      if (s.chopShieldHp > 0) {
        s.chopShieldHp = 0;
      } else {
        s.oppHp = Math.max(0, s.oppHp - 15);
      }
      break;

    case 17:
      if (s.playerHp < 40) {
        s.playerHp = 40;
      } else {
        s.playerHp = Math.min(100, s.playerHp + 10);
      }
      break;

    case 18:
      if (s.currentQuestion) {
        s.currentQuestion = {
          ...s.currentQuestion,
          stem: hideKeyword(s.currentQuestion.stem),
        };
      }
      s.activeMoonNext = true;
      break;

    case 19:
      if (s.currentQuestion?.type === "mcq" && typeof s.currentQuestionAnswer?.index === "number") {
        s.currentQuestion = {
          ...s.currentQuestion,
          sunCorrectIndex: s.currentQuestionAnswer.index,
        };
      } else if (
        s.currentQuestion?.type === "tf" &&
        typeof s.currentQuestionAnswer?.bool === "boolean"
      ) {
        s.currentQuestion = {
          ...s.currentQuestion,
          sunCorrectBool: s.currentQuestionAnswer.bool,
        };
      } else {
        s.activeSunNext = true;
      }
      break;

    case 20:
      break;

    case 21:
      s.pendingWorldAuto = true;
      break;

    default:
      break;
  }

  return finalizePowerUpApply(before, s, slot, major);
}

