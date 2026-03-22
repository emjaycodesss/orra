export interface TarotCard {
  index: number;
  name: string;
  meaning: string;
  pythMeaning: string;
}

export const MAJOR_ARCANA: TarotCard[] = [
  { index: 0, name: "The Fool", meaning: "New beginnings, spontaneity", pythMeaning: "A new position enters — volatility is the price of discovery" },
  { index: 1, name: "The Magician", meaning: "Manifestation, resourcefulness", pythMeaning: "All tools are present — the data aligns for those who read it" },
  { index: 2, name: "The High Priestess", meaning: "Intuition, mystery", pythMeaning: "Hidden flows beneath the surface — watch the EMA, not the candle" },
  { index: 3, name: "The Empress", meaning: "Abundance, nurturing", pythMeaning: "The market bears fruit — confidence narrows as consensus grows" },
  { index: 4, name: "The Emperor", meaning: "Authority, structure", pythMeaning: "Order holds — publishers agree and the spread is tight" },
  { index: 5, name: "The Hierophant", meaning: "Tradition, conformity", pythMeaning: "Follow the consensus — the crowd moves as one today" },
  { index: 6, name: "The Lovers", meaning: "Choices, alignment", pythMeaning: "Two paths diverge — bid and ask speak different truths" },
  { index: 7, name: "The Chariot", meaning: "Determination, willpower", pythMeaning: "Momentum carries all before it — the trend demands respect" },
  { index: 8, name: "Strength", meaning: "Courage, inner power", pythMeaning: "Quiet confidence — low volatility masks deep conviction" },
  { index: 9, name: "The Hermit", meaning: "Solitude, reflection", pythMeaning: "Few publishers speak — the oracle listens to silence" },
  { index: 10, name: "Wheel of Fortune", meaning: "Cycles, fate", pythMeaning: "The regime shifts — what was bull becomes bear in time" },
  { index: 11, name: "Justice", meaning: "Fairness, truth", pythMeaning: "Price and EMA converge — the market finds its fair value" },
  { index: 12, name: "The Hanged Man", meaning: "Surrender, new perspectives", pythMeaning: "Stagnation or wisdom — the market waits for a catalyst" },
  { index: 13, name: "Death", meaning: "Endings, transformation", pythMeaning: "A trend dies so another may be born — watch the crossover" },
  { index: 14, name: "Temperance", meaning: "Balance, patience", pythMeaning: "Moderate confidence, steady trend — patience is rewarded" },
  { index: 15, name: "The Devil", meaning: "Bondage, materialism", pythMeaning: "Leverage traps the unwary — wide spreads hide the cost" },
  { index: 16, name: "The Tower", meaning: "Sudden change, upheaval", pythMeaning: "Protocol hack or flash crash — confidence explodes, trust shatters" },
  { index: 17, name: "The Star", meaning: "Hope, inspiration", pythMeaning: "The Pyth network itself — many publishers, tight confidence, clear skies" },
  { index: 18, name: "The Moon", meaning: "Illusion, fear", pythMeaning: "Wide confidence — the price you see may not be the price you get" },
  { index: 19, name: "The Sun", meaning: "Joy, success", pythMeaning: "Tight confidence, strong momentum — the oracle smiles on this realm" },
  { index: 20, name: "Judgement", meaning: "Rebirth, reckoning", pythMeaning: "The market renders its verdict — all positions are judged" },
  { index: 21, name: "The World", meaning: "Completion, accomplishment", pythMeaning: "Full circle — all nine fields align in harmony" },
];
