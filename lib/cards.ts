export interface TarotCard {
  index: number;
  name: string;
  image: string;
  meaning: string;
  reversedMeaning: string;
  pythMeaning: string;
}

export type CardOrientation = "upright" | "reversed";

/**
 * @description Derives whether a card is reversed from Entropy `randomNumber`.
 * @dev Uses the next bit after the low bits consumed for card index extraction.
 * @param randomNumber - Hex bytes32 string from Entropy callback/event.
 * @returns `true` when reversed, `false` when upright.
 */
export function deriveIsReversed(randomNumber: string): boolean {
  // BigInt constructor accepts `0x` prefixed hex directly.
  const asBigInt = BigInt(randomNumber);
  const orientationBit = (asBigInt >> BigInt(8)) % BigInt(2);
  return orientationBit === BigInt(1);
}

/**
 * @description Convenience mapper from `deriveIsReversed` to orientation label.
 * @param randomNumber - Hex bytes32 string from Entropy callback/event.
 * @returns Orientation string for UI/prompt flows.
 */
export function deriveCardOrientationFromRandom(randomNumber: string): CardOrientation {
  return deriveIsReversed(randomNumber) ? "reversed" : "upright";
}

export const MAJOR_ARCANA: TarotCard[] = [
  { index: 0, name: "The Fool", image: "/cards/0-the-fool.svg", meaning: "New beginnings, spontaneity", reversedMeaning: "Recklessness, hesitation, avoidable risk", pythMeaning: "A new position enters — volatility is the price of discovery" },
  { index: 1, name: "The Magician", image: "/cards/1-the-magician.svg", meaning: "Manifestation, resourcefulness", reversedMeaning: "Misdirection, scattered focus, misuse of tools", pythMeaning: "All tools are present — the data aligns for those who read it" },
  { index: 2, name: "The High Priestess", image: "/cards/2-the-high-priestess.svg", meaning: "Intuition, mystery", reversedMeaning: "Ignored intuition, hidden bias, blocked insight", pythMeaning: "Hidden flows beneath the surface — watch the EMA, not the candle" },
  { index: 3, name: "The Empress", image: "/cards/3-the-empress.svg", meaning: "Abundance, nurturing", reversedMeaning: "Overextension, dependency, neglected foundations", pythMeaning: "The market bears fruit — confidence narrows as consensus grows" },
  { index: 4, name: "The Emperor", image: "/cards/4-the-emperor.svg", meaning: "Authority, structure", reversedMeaning: "Rigidity, control issues, brittle conviction", pythMeaning: "Order holds — publishers agree and the spread is tight" },
  { index: 5, name: "The Hierophant", image: "/cards/5-the-hierophant.svg", meaning: "Tradition, conformity", reversedMeaning: "Dogma fatigue, rebellion, stale playbook", pythMeaning: "Follow the consensus — the crowd moves as one today" },
  { index: 6, name: "The Lovers", image: "/cards/6-the-lovers.svg", meaning: "Choices, alignment", reversedMeaning: "Misalignment, conflicted motives, costly trade-offs", pythMeaning: "Two paths diverge — bid and ask speak different truths" },
  { index: 7, name: "The Chariot", image: "/cards/7-the-chariot.svg", meaning: "Determination, willpower", reversedMeaning: "Loss of control, force without direction", pythMeaning: "Momentum carries all before it — the trend demands respect" },
  { index: 8, name: "Strength", image: "/cards/8-strength.svg", meaning: "Courage, inner power", reversedMeaning: "Self-doubt, reactive behavior, thin patience", pythMeaning: "Quiet confidence — low volatility masks deep conviction" },
  { index: 9, name: "The Hermit", image: "/cards/9-the-hermit.svg", meaning: "Solitude, reflection", reversedMeaning: "Isolation, overanalysis, missing the moment", pythMeaning: "Few publishers speak — the oracle listens to silence" },
  { index: 10, name: "Wheel of Fortune", image: "/cards/10-wheel-of-fortune.svg", meaning: "Cycles, fate", reversedMeaning: "Resistance to change, unlucky timing, repeated patterns", pythMeaning: "The regime shifts — what was bull becomes bear in time" },
  { index: 11, name: "Justice", image: "/cards/11-justice.svg", meaning: "Fairness, truth", reversedMeaning: "Distortion, accountability gaps, skewed judgment", pythMeaning: "Price and EMA converge — the market finds its fair value" },
  { index: 12, name: "The Hanged Man", image: "/cards/12-the-hanged-man.svg", meaning: "Surrender, new perspectives", reversedMeaning: "Stalled action, needless sacrifice, refusal to reframe", pythMeaning: "Stagnation or wisdom — the market waits for a catalyst" },
  { index: 13, name: "Death", image: "/cards/13-death.svg", meaning: "Endings, transformation", reversedMeaning: "Clinging to the past, delayed transition", pythMeaning: "A trend dies so another may be born — watch the crossover" },
  { index: 14, name: "Temperance", image: "/cards/14-temperance.svg", meaning: "Balance, patience", reversedMeaning: "Imbalance, excess, timing mismatch", pythMeaning: "Moderate confidence, steady trend — patience is rewarded" },
  { index: 15, name: "The Devil", image: "/cards/15-the-devil.svg", meaning: "Bondage, materialism", reversedMeaning: "Breaking unhealthy loops, reclaiming agency", pythMeaning: "Leverage traps the unwary — wide spreads hide the cost" },
  { index: 16, name: "The Tower", image: "/cards/16-the-tower.svg", meaning: "Sudden change, upheaval", reversedMeaning: "Slow collapse, avoided truth, delayed reset", pythMeaning: "Protocol hack or flash crash — confidence explodes, trust shatters" },
  { index: 17, name: "The Star", image: "/cards/17-the-star.svg", meaning: "Hope, inspiration", reversedMeaning: "Doubt, dim optimism, faith under pressure", pythMeaning: "The Pyth network itself — many publishers, tight confidence band" },
  { index: 18, name: "The Moon", image: "/cards/18-the-moon.svg", meaning: "Illusion, fear", reversedMeaning: "Revealed confusion, anxiety release, clearer signal emerging", pythMeaning: "Wide confidence — the price you see may not be the price you get" },
  { index: 19, name: "The Sun", image: "/cards/19-the-sun.svg", meaning: "Joy, success", reversedMeaning: "Temporary clouding, overconfidence, delayed clarity", pythMeaning: "Tight confidence, strong momentum — the oracle smiles on this realm" },
  { index: 20, name: "Judgement", image: "/cards/20-judgement.svg", meaning: "Rebirth, reckoning", reversedMeaning: "Self-doubt, postponed decision, incomplete closure", pythMeaning: "The market renders its verdict — all positions are judged" },
  { index: 21, name: "The World", image: "/cards/21-the-world.svg", meaning: "Completion, accomplishment", reversedMeaning: "Loose ends, unfinished cycle, integration pending", pythMeaning: "Full circle — all nine fields align in harmony" },
];
