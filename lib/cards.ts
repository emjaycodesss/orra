export interface TarotCard {
  index: number;
  name: string;
  image: string;
  meaning: string;
  reversedMeaning: string;
  pythFocus: string;
}

export type CardOrientation = "upright" | "reversed";

export function deriveIsReversed(randomNumber: string): boolean {
  const asBigInt = BigInt(randomNumber);
  const orientationBit = (asBigInt >> BigInt(8)) % BigInt(2);
  return orientationBit === BigInt(1);
}

export function deriveCardOrientationFromRandom(randomNumber: string): CardOrientation {
  return deriveIsReversed(randomNumber) ? "reversed" : "upright";
}

export const MAJOR_ARCANA: TarotCard[] = [
  {
    index: 0, name: "The Fool", image: "/cards/0-the-fool.svg",
    meaning: "New beginnings, spontaneity",
    reversedMeaning: "Recklessness, hesitation, avoidable risk",
    pythFocus: "Lead with regime and momentum — is the market genuinely open to new movement or is this a false start? Support with confidencePct and spreadPct to assess whether conditions favor bold entry or warn against it.",
  },
  {
    index: 1, name: "The Magician", image: "/cards/1-the-magician.svg",
    meaning: "Manifestation, resourcefulness",
    reversedMeaning: "Misdirection, scattered focus, misuse of tools",
    pythFocus: "Lead with publisherCount and signalClarity — are all instruments aligned? Support with regime and spreadPct. High consensus + tight spread = all tools present. Fragmented data = the magician's hand is incomplete.",
  },
  {
    index: 2, name: "The High Priestess", image: "/cards/2-the-high-priestess.svg",
    meaning: "Intuition, mystery",
    reversedMeaning: "Ignored intuition, hidden bias, blocked insight",
    pythFocus: "Lead with confidenceDrift and emaPrice vs price divergence — what lies beneath the surface? Support with signalClarity. Widening drift + EMA divergence = the oracle knows something the candle doesn't show.",
  },
  {
    index: 3, name: "The Empress", image: "/cards/3-the-empress.svg",
    meaning: "Abundance, nurturing",
    reversedMeaning: "Overextension, dependency, neglected foundations",
    pythFocus: "Lead with regime and momentum — is the market in a state of genuine growth? Support with publisherCount and confidencePct. High consensus + bull regime + tight CI = abundant conditions. Reversed: overextension shows as momentum outpacing confidence.",
  },
  {
    index: 4, name: "The Emperor", image: "/cards/4-the-emperor.svg",
    meaning: "Authority, structure",
    reversedMeaning: "Rigidity, control issues, brittle conviction",
    pythFocus: "Lead with publisherCount and signalClarity — how strong is the structural consensus? Support with spreadPct and regime. High publishers + tight spread + stable drift = order holds. Reversed: brittle structure shows as high publishers but widening CI.",
  },
  {
    index: 5, name: "The Hierophant", image: "/cards/5-the-hierophant.svg",
    meaning: "Tradition, conformity",
    reversedMeaning: "Dogma fatigue, rebellion, stale playbook",
    pythFocus: "Lead with confidenceDrift and regime — is the market following established patterns? Support with publisherCount. Stable drift + neutral/bull regime = crowd moves as one. Reversed: stale playbook shows as momentum diverging from EMA consensus.",
  },
  {
    index: 6, name: "The Lovers", image: "/cards/6-the-lovers.svg",
    meaning: "Choices, alignment",
    reversedMeaning: "Misalignment, conflicted motives, costly trade-offs",
    pythFocus: "Lead with spreadPct and bid/ask divergence — do the two sides of the market agree? Support with regime and signalClarity. Tight spread + aligned regime = paths converge. Wide spread + conflicting signals = the lovers are at odds.",
  },
  {
    index: 7, name: "The Chariot", image: "/cards/7-the-chariot.svg",
    meaning: "Determination, willpower",
    reversedMeaning: "Loss of control, force without direction",
    pythFocus: "Lead with momentum and regime — how strong and directional is the move? Support with confidencePct and publisherCount. Strong momentum + bull/bear regime + tight CI = chariot in full force. Reversed: high momentum but widening CI = force without control.",
  },
  {
    index: 8, name: "Strength", image: "/cards/8-strength.svg",
    meaning: "Courage, inner power",
    reversedMeaning: "Self-doubt, reactive behavior, thin patience",
    pythFocus: "Lead with signalClarity and confidenceDrift — is the market holding quiet conviction? Support with spreadPct and publisherCount. Tight CI + stable drift + deep liquidity = strength expressed as calm certainty. Reversed: low publishers + widening drift = conviction eroding.",
  },
  {
    index: 9, name: "The Hermit", image: "/cards/9-the-hermit.svg",
    meaning: "Solitude, reflection",
    reversedMeaning: "Isolation, overanalysis, missing the moment",
    pythFocus: "Lead with publisherCount and marketSession — how many voices speak and when? Support with signalClarity and isStale. Low publishers + off-hours session = oracle in solitude. Reversed: stale feed + low publishers = isolation becoming dangerous blindness.",
  },
  {
    index: 10, name: "Wheel of Fortune", image: "/cards/10-wheel-of-fortune.svg",
    meaning: "Cycles, fate",
    reversedMeaning: "Resistance to change, unlucky timing, repeated patterns",
    pythFocus: "Lead with regime and confidenceDrift — is a shift underway or imminent? Support with momentum and emaPrice divergence. Regime transition + widening drift + momentum reversal = the wheel turns. Reversed: drift widening but price clinging to old regime = resisting the inevitable.",
  },
  {
    index: 11, name: "Justice", image: "/cards/11-justice.svg",
    meaning: "Fairness, truth",
    reversedMeaning: "Distortion, accountability gaps, skewed judgment",
    pythFocus: "Lead with price vs emaPrice convergence and signalClarity — is the market finding fair value? Support with publisherCount and spreadPct. Price near EMA + tight CI + high publishers = justice served. Reversed: price far from EMA + wide spread = distorted market, skewed truth.",
  },
  {
    index: 12, name: "The Hanged Man", image: "/cards/12-the-hanged-man.svg",
    meaning: "Surrender, new perspectives",
    reversedMeaning: "Stalled action, needless sacrifice, refusal to reframe",
    pythFocus: "Lead with momentum and regime — is the market genuinely paused or stuck? Support with confidenceDrift and marketSession. Near-zero momentum + stable drift + neutral regime = intentional pause. Reversed: stalled momentum + widening CI = stagnation without insight.",
  },
  {
    index: 13, name: "Death", image: "/cards/13-death.svg",
    meaning: "Endings, transformation",
    reversedMeaning: "Clinging to the past, delayed transition",
    pythFocus: "Lead with regime transition signals and momentum crossover — is something ending? Support with confidenceDrift and emaPrice. Regime flip + momentum crossing zero + widening drift = transformation underway. Reversed: old regime persisting despite widening CI = clinging to what is already ending.",
  },
  {
    index: 14, name: "Temperance", image: "/cards/14-temperance.svg",
    meaning: "Balance, patience",
    reversedMeaning: "Imbalance, excess, timing mismatch",
    pythFocus: "Lead with signalClarity and confidenceDrift — is the oracle in a measured, stable state? Support with spreadPct and momentum. Moderate CI + stable drift + balanced spread = temperance conditions. Reversed: momentum spiking against stable CI = excess breaking the balance.",
  },
  {
    index: 15, name: "The Devil", image: "/cards/15-the-devil.svg",
    meaning: "Bondage, materialism",
    reversedMeaning: "Breaking unhealthy loops, reclaiming agency",
    pythFocus: "Lead with spreadPct and regime — what hidden costs does the market impose? Support with extremeDisagreement and confidenceDrift. Wide spread + persistent regime + extreme disagreement = trapped by the market's terms. Reversed: spread narrowing + drift stabilizing = chains loosening.",
  },
  {
    index: 16, name: "The Tower", image: "/cards/16-the-tower.svg",
    meaning: "Sudden change, upheaval",
    reversedMeaning: "Slow collapse, avoided truth, delayed reset",
    pythFocus: "Lead with confidenceDrift and extremeDisagreement — is rupture already happening? Support with spreadPct and momentum. Widening drift + extreme disagreement + spread spiking = tower moment. Reversed: slow drift widening + calm surface = collapse building unseen.",
  },
  {
    index: 17, name: "The Star", image: "/cards/17-the-star.svg",
    meaning: "Hope, inspiration",
    reversedMeaning: "Doubt, dim optimism, faith under pressure",
    pythFocus: "Lead with confidencePct and publisherCount — how clear and well-attested is the oracle? Support with regime and momentum. Tight CI + high publishers + bull regime = star conditions, rare clarity. Reversed: high publishers but widening CI = many voices, diminishing hope.",
  },
  {
    index: 18, name: "The Moon", image: "/cards/18-the-moon.svg",
    meaning: "Illusion, fear",
    reversedMeaning: "Revealed confusion, anxiety release, clearer signal emerging",
    pythFocus: "Lead with signalClarity and isStale — how much does the oracle obscure? Support with confidenceDrift and extremeDisagreement. Wide CI + stale feed + extreme disagreement = moon territory, illusion and fear. Reversed: CI narrowing from wide = fog beginning to lift.",
  },
  {
    index: 19, name: "The Sun", image: "/cards/19-the-sun.svg",
    meaning: "Joy, success",
    reversedMeaning: "Temporary clouding, overconfidence, delayed clarity",
    pythFocus: "Lead with confidencePct and momentum — is the oracle radiating clarity and upward force? Support with publisherCount and regime. Tight CI + strong bull momentum + high publishers = sun conditions. Reversed: bull momentum but CI widening = brightness dimming, overconfidence emerging.",
  },
  {
    index: 20, name: "Judgement", image: "/cards/20-judgement.svg",
    meaning: "Rebirth, reckoning",
    reversedMeaning: "Self-doubt, postponed decision, incomplete closure",
    pythFocus: "Lead with regime and confidenceDrift — is the market rendering a verdict? Support with momentum and publisherCount. Strong regime + stable drift + high publishers = reckoning is clear. Reversed: regime signal present but low publishers + drifting CI = verdict unclear, decision postponed.",
  },
  {
    index: 21, name: "The World", image: "/cards/21-the-world.svg",
    meaning: "Completion, accomplishment",
    reversedMeaning: "Loose ends, unfinished cycle, integration pending",
    pythFocus: "Lead with all fields in concert — does the full oracle picture align? Tight CI + high publishers + stable drift + clear regime + tight spread + fresh feed = world conditions, rare total alignment. Reversed: most fields aligned but one or two outliers = cycle almost complete, not yet.",
  },
];