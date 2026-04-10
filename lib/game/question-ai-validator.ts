/**
 * Ground truth validation for AI-generated questions.
 * Checks factual consistency against the Pyth live data snapshot.
 */

interface LiveData {
  symbol: string;
  price: number;
  change24h: number;
}

interface AiQuestion {
  stem: string;
  options: string[];
  correctIndex: number;
}

/** Canonical Pyth marketing numbers referenced when rejecting wrong MCQ latency claims. */
const PYTH_CONSTANTS = {
  solanaUpdateMs: 400,
  lazerMinMs: 50,
  supportedChains: 55,
  totalFeeds: 500,
};

function lower(s: string) {
  return s.toLowerCase();
}

/** Absolute tolerance for “approximately X%” return claims vs snapshot (basis points floor for tiny moves). */
function returnClaimToleranceAbs(actualPct: number): number {
  const a = Math.abs(actualPct);
  return Math.max(0.12, a * 0.35);
}

/**
 * If the stem embeds a directional % move (e.g. “rose ~0.6%”), checks answerBool matches snapshot truth.
 * Stems without a clear numeric return claim always pass (conceptual TFs).
 */
export function validateLiveTfNumericConsistency(
  stem: string,
  answerBool: boolean,
  liveData: LiveData,
): boolean {
  const s = lower(stem);
  const pctMatches = [...s.matchAll(/(\d+\.?\d*)\s*%/g)].map((m) => Number(m[1]));
  if (pctMatches.length === 0) return true;

  const upCue =
    s.includes("rose") ||
    s.includes("increased") ||
    s.includes("gained") ||
    s.includes("pumping") ||
    s.includes("up ") ||
    s.includes("higher") ||
    s.includes("rally") ||
    s.includes("bull");
  const downCue =
    s.includes("fell") ||
    s.includes("decreased") ||
    s.includes("dropped") ||
    s.includes("dumping") ||
    s.includes("down ") ||
    s.includes("lower") ||
    s.includes("bear");

  if (!upCue && !downCue) return true;

  const claimedMag = pctMatches.reduce((a, b) => (Math.abs(b - Math.abs(liveData.change24h)) < Math.abs(a - Math.abs(liveData.change24h)) ? b : a), pctMatches[0]!);
  const actual = liveData.change24h;
  const tol = returnClaimToleranceAbs(actual);

  let statementTrue: boolean;
  if (upCue && !downCue) {
    statementTrue =
      actual > 0 && Math.abs(Math.abs(actual) - claimedMag) <= tol;
  } else if (downCue && !upCue) {
    statementTrue =
      actual < 0 && Math.abs(Math.abs(actual) - claimedMag) <= tol;
  } else {
    return true;
  }

  return answerBool === statementTrue;
}

/**
 * When MCQ options contain % figures tied to price return, require the marked correct option
 * to be closest to returnOverWindowPct (same as liveData.change24h) within tolerance.
 */
export function validateMcqNumericReturnOption(q: AiQuestion, liveData: LiveData): boolean {
  const actual = liveData.change24h;
  const opts = q.options.map((o, i) => ({ i, o: lower(o) }));
  const parsed = opts.map(({ i, o }) => {
    const nums = [...o.matchAll(/(\d+\.?\d*)\s*%/g)].map((m) => Number(m[1]));
    if (nums.length === 0) return { i, value: null as number | null };
    const up =
      o.includes("rose") ||
      o.includes("up") ||
      o.includes("increased") ||
      o.includes("gained") ||
      o.includes("higher");
    const down =
      o.includes("fell") ||
      o.includes("down") ||
      o.includes("decreased") ||
      o.includes("dropped") ||
      o.includes("lower");
    let v = nums[nums.length - 1]!;
    if (down && !up) v = -Math.abs(v);
    else if (up && !down) v = Math.abs(v);
    else v = actual >= 0 ? Math.abs(v) : -Math.abs(v);
    return { i, value: v };
  });

  const withVals = parsed.filter((p) => p.value !== null) as { i: number; value: number }[];
  if (withVals.length < 2) return true;

  const tol = returnClaimToleranceAbs(actual);
  const correctIdx = q.correctIndex;
  const correctVal = parsed[correctIdx]?.value;
  if (correctVal === null || correctVal === undefined) return false;

  if (Math.abs(correctVal - actual) > tol) return false;

  for (const p of withVals) {
    if (p.i === correctIdx) continue;
    if (Math.abs(p.value - actual) < Math.abs(correctVal - actual) - 1e-6) return false;
  }
  return true;
}

/**
 * Validates an AI-generated question against live price data and known constants.
 * Returns true if the question passes all ground truth checks.
 * Rejects stems that assert up/down when the 24h snapshot disagrees.
 */
export function validateAiQuestion(q: AiQuestion, liveData: LiveData): boolean {
  const stem = lower(q.stem);
  const correctAnswer = lower(q.options[q.correctIndex] ?? "");

  const stemAssertsDown =
    stem.includes("falling") ||
    stem.includes("is down") ||
    stem.includes("dumping") ||
    stem.includes("bear market") ||
    stem.includes("decreased");

  const stemAssertsUp =
    stem.includes("rising") ||
    stem.includes("is up") ||
    stem.includes("pumping") ||
    stem.includes("bull market") ||
    stem.includes("increased");

  if (stemAssertsDown && liveData.change24h > 0) return false;
  if (stemAssertsUp && liveData.change24h < 0) return false;

  const stemMentionsDirection =
    stem.includes("up") ||
    stem.includes("down") ||
    stem.includes("rising") ||
    stem.includes("falling") ||
    stem.includes("bull") ||
    stem.includes("bear") ||
    stem.includes("increased") ||
    stem.includes("decreased") ||
    stem.includes("pumping") ||
    stem.includes("dumping");

  if (stemMentionsDirection) {
    const expectingUp =
      correctAnswer.includes("up") ||
      correctAnswer.includes("bull") ||
      correctAnswer.includes("rising") ||
      correctAnswer.includes("increased") ||
      correctAnswer.includes("pumping");

    const expectingDown =
      correctAnswer.includes("down") ||
      correctAnswer.includes("bear") ||
      correctAnswer.includes("falling") ||
      correctAnswer.includes("decreased") ||
      correctAnswer.includes("dumping");

    if (expectingUp && liveData.change24h < 0) return false;
    if (expectingDown && liveData.change24h > 0) return false;
  }

  if (
    (stem.includes("how fast") || stem.includes("update") || stem.includes("latency")) &&
    stem.includes("solana")
  ) {
    const claimsWrongMs =
      correctAnswer.includes("1000ms") ||
      correctAnswer.includes("5000ms") ||
      correctAnswer.includes("100ms") ||
      correctAnswer.includes("200ms");
    if (claimsWrongMs) return false;
    void PYTH_CONSTANTS.solanaUpdateMs;
  }

  if (stem.includes("lazer") && (stem.includes("latency") || stem.includes("fast"))) {
    const claimsWrongMs =
      correctAnswer.includes("400ms") ||
      correctAnswer.includes("1000ms") ||
      correctAnswer.includes("5000ms");
    if (claimsWrongMs) return false;
    void PYTH_CONSTANTS.lazerMinMs;
  }

  return true;
}
