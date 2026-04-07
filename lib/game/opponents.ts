export interface OpponentDef {
  name: string;
  flavor: string;
  maxHp: number;
  wrongDamageToPlayer: number;
  damageToOpponentOnCorrect: number;
}

export const OPPONENTS: OpponentDef[] = [
  {
    name: "Intern Node",
    flavor: "Onboarding basics",
    maxHp: 90,
    wrongDamageToPlayer: 12,
    damageToOpponentOnCorrect: 15,
  },
  {
    name: "Index Publisher",
    flavor: "Feeds & benchmarks",
    maxHp: 100,
    wrongDamageToPlayer: 15,
    damageToOpponentOnCorrect: 15,
  },
  {
    name: "Entropy Keeper",
    flavor: "Oracle truth",
    maxHp: 120,
    wrongDamageToPlayer: 18,
    damageToOpponentOnCorrect: 15,
  },
];

export const MAX_QUESTIONS_PER_DUEL = 7;
