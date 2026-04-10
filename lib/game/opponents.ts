interface OpponentDef {
  name: string;
  displayName: string;
  image: string;
  flavor: string;
  /** Guardian wins an exchange (player answered wrong). */
  winTaunts: string[];
  /** Guardian gets defeated at end of duel segment. */
  defeatTaunts: string[];
  /** Arena K.O. subtitle under "K.O." (slang, one line picked per defeat). */
  koBannerLines: string[];
  taunts: string[];
  correctTaunts: string[];
  /** Optional split pools for contextual taunts (e.g. Chop shield state). */
  correctTauntsShieldUp?: string[];
  correctTauntsShieldDown?: string[];
  maxHp: number;
  wrongDamageToPlayer: number;
  damageToOpponentOnCorrect: number;
  scene: string;
}

export const OPPONENTS: OpponentDef[] = [
  {
    name: "The Gatekeeper: Planck",
    displayName: "Planck",
    image: "/bosses/Planck.jpg",
    flavor: "I guard the first gate. Show me you can read signal under pressure.",
    winTaunts: [
      "Tourist energy. Guardian Planck collects that toll.",
      "Latency is a tax. You just paid it.",
      "Guardian confirms your signal was noise.",
      "Confidence interval says not even close.",
      "Your timing drifted and the market noticed.",
      "You hesitated and got filled at the worst level.",
      "That read was late by a full candle.",
      "Data moved first and you followed second.",
    ],
    defeatTaunts: [
      "Clean execution... Guardian Planck yields this gate.",
      "You earned passage. Don't waste it upstream.",
      "You cooked that gate. Reads were finally precise.",
      "You broke the first ward. Respect.",
      "You found signal inside the noise. Gate opens.",
      "Solid execution. Planck steps aside.",
    ],
    koBannerLines: [
      "You cooked! Planck down.",
      "Planck folded. Gate's yours.",
      "First ward erased. No notes.",
      "That's lethal. Planck out cold.",
      "Washed. Planck never stood a chance.",
    ],
    taunts: [
      "Tourist spotted. Pull a price, not a prank.",
      "Too slow for the feed. Bring 400ms energy.",
      "Latency kills. Try the fast lane.",
      "That answer had a 2% confidence interval.",
      "Publishers don't guess. Neither should you.",
      "Slippage. On a quiz.",
      "Your thesis is loud but your timing is quiet.",
      "Price moved and you were still loading.",
      "Signal is clean. Your read is not.",
      "You tried to front run certainty and lost.",
    ],
    correctTaunts: [
      "Lucky pull. Won't save you at 400ms.",
      "One clean read. Don't get comfortable.",
      "Even a stopped clock is right twice.",
      "Fine. You got that one.",
      "You scraped by. Feed won't always be that clean.",
      "Good read. Keep that pace if you can.",
      "You caught the tick. Next one bites harder.",
      "That one clears. Consistency is the real test.",
      "You nailed the print. Now do it again.",
    ],
    maxHp: 90,
    wrongDamageToPlayer: 12,
    damageToOpponentOnCorrect: 15,
    scene: "arena-scene--planck",
  },
  {
    name: "The Tactician: K.tizz",
    displayName: "K.tizz",
    image: "/bosses/K.tizz.jpg",
    flavor: "I read patterns before they happen. If you telegraph, I punish.",
    winTaunts: [
      "Guardian K.tizz read your hand before you played it.",
      "Adapt slower, lose faster. That's the tape.",
      "Guardian call your edge got arbitraged.",
      "You traded vibes into a spread. Painful.",
      "You telegraphed the move and paid for it.",
      "That was a clean trap and you stepped in.",
      "I priced your hesitation before you clicked.",
      "You blinked first and the edge disappeared.",
    ],
    defeatTaunts: [
      "Fine. You out-adapted me this round.",
      "Guardian K.tizz taps out. Nice tape read.",
      "You forced the pivot. I'll remember that.",
      "You earned this breach. Move with intent.",
      "You changed tempo and broke my setup.",
      "Sharp sequence. You took the lane from me.",
    ],
    koBannerLines: [
      "You cooked! K.tizz taps out.",
      "Tape read was nasty. K.tizz down.",
      "K.tizz got out-rotated. Respect.",
      "That's body-bag energy. K.tizz done.",
      "Tactician diff'd. K.tizz fried.",
    ],
    taunts: [
      "Your best card? Sealed. Trade the tape, not the myth.",
      "Adapt or liquidate. Markets don't care about vibes.",
      "I'm reading your hand and your slippage.",
      "Wrong move. Liquidated.",
      "That spread was obvious. You missed it.",
      "Reading my hand was easier than reading that question?",
      "You reached for alpha and grabbed air.",
      "That setup was fake from the first tick.",
      "You chase headlines. I trade structure.",
      "You got baited by momentum theater.",
    ],
    correctTaunts: [
      "You read the tape once. Don't celebrate.",
      "That's called variance, not skill.",
      "One signal doesn't make a strategy.",
      "Noted. I'm adapting.",
      "You got lucky with the spread on that one.",
      "Decent execution. Keep your risk tight.",
      "You found flow for one beat. I hear it.",
      "That entry was clean. Exit still matters.",
      "Respect the read. Now survive the next one.",
    ],
    maxHp: 100,
    wrongDamageToPlayer: 15,
    damageToOpponentOnCorrect: 15,
    scene: "arena-scene--ktizz",
  },
  {
    name: "The Final Boss: Chop",
    displayName: "Chop",
    image: "/bosses/chop.jpg",
    flavor: "I don't care about confidence. I care about precision when it counts.",
    winTaunts: [
      "Guardian Chop verdict rejected. Precision missing.",
      "Shield held. Your thesis did not.",
      "Median says no. Guardian confirmed.",
      "You chased noise into the void.",
      "You brought heat but not accuracy.",
      "Your model broke where pressure starts.",
      "I saw that mistake three moves ago.",
      "That guess would not clear final audit.",
    ],
    defeatTaunts: [
      "Shield shattered... Guardian Chop acknowledges you.",
      "You carved through certainty itself. Impressive.",
      "You cooked the run. Conviction finally matched the data.",
      "You broke the final ward. Arena remembers.",
      "Final wall falls. Your discipline held.",
      "You solved the hard path under pressure.",
    ],
    koBannerLines: [
      "You cooked! Chop finally folded.",
      "Final boss fried. Chop down.",
      "Shield broke, ego too. Chop out.",
      "OD. Chop deleted.",
      "Endgame diff. Chop done.",
    ],
    taunts: [
      "Confidence interval near zero. Precision hurts, doesn't it?",
      "Shield online. Come audit this hitbox.",
      "Break through that. Median says no.",
      "Direct damage to your credibility.",
      "Even the EMA called that one wrong.",
      "You're trading noise, not signal.",
      "Every sloppy read gets marked in red.",
      "Final table rules do not forgive drift.",
      "You need precision not hope.",
      "You are close enough to fail loudly.",
    ],
    correctTaunts: [
      "Good answer. You are finally on tempo.",
      "You found the gap. It closes next question.",
      "Confidence interval is still against you.",
      "You clipped the edge. Push harder.",
      "Better timing. Keep the pressure.",
      "That landed. Next window is tighter.",
      "Sharp read. Final rounds get meaner.",
    ],
    correctTauntsShieldUp: [
      "Shield's still up. Precision doesn't matter yet.",
      "Dent in the armor. I've got plenty left.",
      "Clean strike. Shield still breathing.",
      "You hit the shell, not the core.",
      "Shield took it. I am still standing.",
    ],
    correctTauntsShieldDown: [
      "Shield is gone. Now this gets honest.",
      "You broke the shell. Keep your nerve.",
      "Now you can actually hurt me.",
      "No barrier left. Finish what you started.",
      "The shield is down. Precision decides this.",
    ],
    maxHp: 120,
    wrongDamageToPlayer: 18,
    damageToOpponentOnCorrect: 15,
    scene: "arena-scene--chop",
  },
];

export const MAX_QUESTIONS_PER_DUEL = 7;

/**
 * Random one-liner for the arena K.O. flash (boss-specific slang).
 * Falls back if `displayName` does not match a known guardian.
 */
export function pickGuardianKoBanner(displayName: string): string {
  const opp = OPPONENTS.find((o) => o.displayName === displayName);
  const pool = opp?.koBannerLines;
  if (pool && pool.length > 0) {
    return pool[Math.floor(Math.random() * pool.length)]!;
  }
  return `You cooked! ${displayName} down.`;
}
