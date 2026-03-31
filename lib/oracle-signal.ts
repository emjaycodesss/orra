import type { OracleState, SignalClarity } from "@/lib/oracleState";

export interface DashboardOracleSignal {
  label: string;
  description: string;
  glow: string;
}

function phraseIndex(symbolKey: string, salt: number): number {
  let h = salt;
  for (let i = 0; i < symbolKey.length; i++) {
    h = (h * 31 + symbolKey.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 1000;
}

function pick(pool: readonly string[], symbolKey: string, salt: number): string {
  if (pool.length === 0) return "";
  return pool[phraseIndex(symbolKey, salt) % pool.length];
}

const VOICE_TURBULENT = [
  "Voices clash on the mark.",
  "Stormlight on the tape — no single price pins the story.",
  "The oracle quarrels with itself.",
] as const;

const VOICE_DORMANT = [
  "The market sleeps.",
  "Quiet courts — the oracle hears little.",
  "The bazaar is shuttered; only echoes remain.",
] as const;

const VOICE_STALE = [
  "The last whisper grows cold.",
  "No fresh tick has crossed the veil.",
  "The oracle waits on a renewed pulse.",
] as const;

const VOICE_TIGHT = [
  "The oracle's gaze is steady.",
  "Clarity gathers on the mark.",
  "Little stands between price and truth.",
] as const;

const VOICE_MODERATE = [
  "The picture firms, but not without noise.",
  "A chord sounds — imperfect, yet present.",
  "The oracle reads through static.",
] as const;

const VOICE_WIDE = [
  "Many tongues name different prices.",
  "The mark wavers between publishers.",
  "Consensus frays at the edges.",
] as const;

const VOICE_EXTREME = [
  "Chaos crowds the center.",
  "No throne for a single truth.",
  "The veil tears where publishers disagree.",
] as const;

const VOICE_UNFAVORABLE = [
  "Shadow leans on the path.",
  "The oracle offers little comfort here.",
  "Headwinds press the mark.",
] as const;

const VOICE_UNCERTAIN = [
  "The signs refuse a neat verdict.",
  "Fog between what was and what is.",
  "The oracle hedges; so should you.",
] as const;

function voiceForClarity(c: SignalClarity, symbolKey: string, salt: number): string {
  switch (c) {
    case "tight":
      return pick(VOICE_TIGHT, symbolKey, salt);
    case "moderate":
      return pick(VOICE_MODERATE, symbolKey, salt);
    case "wide":
      return pick(VOICE_WIDE, symbolKey, salt);
    case "extreme":
      return pick(VOICE_EXTREME, symbolKey, salt);
    default:
      return pick(VOICE_MODERATE, symbolKey, salt);
  }
}

function formatConfBandPct(pct: number): string {
  if (pct >= 1) return pct.toFixed(2);
  if (pct >= 0.01) return pct.toFixed(3);
  return pct.toFixed(4);
}

function formatMoveFromOpen(periodChangePct: number): string {
  const a = Math.abs(periodChangePct);
  if (a < 0.05) return "essentially flat";
  const d = a >= 10 ? 1 : a >= 1 ? 2 : 3;
  const word = periodChangePct > 0 ? "up" : "down";
  return `${word} ${a.toFixed(d)}%`;
}

function sentenceLiveFact(
  oracle: OracleState,
  periodChangePct: number,
  rangeLabel: string,
): string {
  const band = formatConfBandPct(oracle.confidencePct);
  const sp = oracle.spreadPct.toFixed(3);
  const n = oracle.publisherCount;
  const move = formatMoveFromOpen(periodChangePct);
  return `Across ${rangeLabel} the mark is ${move} from the open; publishers show a ±${band}% confidence band, ${sp}% bid–ask spread, and ${n} active ${n === 1 ? "voice" : "voices"}.`;
}

function joinTwoSentences(a: string, b: string): string {
  const t = (s: string) => s.trim();
  return `${t(a)} ${t(b)}`.trim();
}

export interface DashboardOracleSignalOptions {
  rangeLabel: string;
  symbolKey?: string;
}

export function computeDashboardOracleSignal(
  oracle: OracleState,
  periodChangePct: number,
  options: DashboardOracleSignalOptions,
): DashboardOracleSignal {
  const symbolKey = options.symbolKey ?? "";
  const { rangeLabel } = options;

  const agreementBand =
    oracle.confidencePct < 0.5
      ? "tight"
      : oracle.confidencePct < 1
        ? "mixed"
        : oracle.confidencePct < 2
          ? "wide"
          : "extreme";
  let s = 50;
  if (periodChangePct > 2) s += 20;
  else if (periodChangePct > 0.5) s += 12;
  else if (periodChangePct > 0) s += 5;
  else if (periodChangePct > -0.5) s -= 5;
  else if (periodChangePct > -2) s -= 12;
  else s -= 20;
  if (oracle.confidencePct < 0.5) s += 8;
  else if (oracle.confidencePct >= 2) s -= 10;
  if (oracle.spreadPct < 0.02) s += 7;
  else if (oracle.spreadPct >= 0.5) s -= 10;
  const score = Math.max(0, Math.min(100, s));

  if (oracle.extremeDisagreement) {
    const v = pick(VOICE_TURBULENT, symbolKey, 11);
    const fact =
      "Publishers land on sharply different confidence bands — treat every print as provisional, not settled.";
    return {
      label: "Turbulent",
      description: joinTwoSentences(v, fact),
      glow: "rgba(220, 38, 38, 0.05)",
    };
  }

  if (oracle.isStale && oracle.marketSession === "closed") {
    const v = pick(VOICE_DORMANT, symbolKey, 17);
    const fact =
      "The session is closed and the tape is quiet — stillness here is ordinary, not a broken feed.";
    return {
      label: "Dormant",
      description: joinTwoSentences(v, fact),
      glow: "rgba(107, 90, 130, 0.04)",
    };
  }

  if (oracle.isStale) {
    const v = pick(VOICE_STALE, symbolKey, 23);
    const fact =
      "No sufficiently fresh tick has arrived — hold the last mark lightly until the stream stirs again.";
    return {
      label: "Cautious",
      description: joinTwoSentences(v, fact),
      glow: "rgba(124, 58, 237, 0.05)",
    };
  }

  const factLive = sentenceLiveFact(oracle, periodChangePct, rangeLabel);

  if (score >= 70 && agreementBand === "tight") {
    const v = voiceForClarity("tight", symbolKey, 31);
    return {
      label: "Favorable",
      description: joinTwoSentences(v, factLive),
      glow: "rgba(22, 163, 74, 0.05)",
    };
  }

  if (score >= 50) {
    const v = voiceForClarity(oracle.signalClarity, symbolKey, 37);
    return {
      label: "Cautious",
      description: joinTwoSentences(v, factLive),
      glow: "rgba(124, 58, 237, 0.05)",
    };
  }

  if (score < 30) {
    const v = pick(VOICE_UNFAVORABLE, symbolKey, 41);
    return {
      label: "Unfavorable",
      description: joinTwoSentences(v, factLive),
      glow: "rgba(220, 38, 38, 0.04)",
    };
  }

  const v = pick(VOICE_UNCERTAIN, symbolKey, 43);
  return {
    label: "Uncertain",
    description: joinTwoSentences(v, factLive),
    glow: "rgba(107, 90, 130, 0.04)",
  };
}

export function oracleSignalColor(label: string): string {
  if (label === "Favorable") return "var(--positive)";
  if (label === "Cautious") return "var(--caution)";
  if (label === "Turbulent" || label === "Unfavorable") return "var(--danger)";
  if (label === "Dormant") return "var(--ink-500)";
  return "var(--ink-500)";
}
