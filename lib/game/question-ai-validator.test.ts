import { describe, it, expect } from "vitest";
import {
  validateAiQuestion,
  validateLiveTfNumericConsistency,
  validateMcqNumericReturnOption,
} from "./question-ai-validator";

const baseLive = {
  symbol: "BTC/USD",
  price: 65000,
  change24h: 1.5,
};

describe("validateAiQuestion", () => {
  it("passes a neutral question with no detectable claims", () => {
    const q = {
      stem: "What does Pyth Network provide?",
      options: ["Price feeds", "NFTs", "DEX trading", "Lending"],
      correctIndex: 0,
    };
    expect(validateAiQuestion(q, baseLive)).toBe(true);
  });

  it("fails when answer claims price is DOWN but change24h is positive", () => {
    const q = {
      stem: "BTC is currently falling. Which oracle model delivered this?",
      options: ["Pull oracle", "Push oracle", "Scraping node", "Manual entry"],
      correctIndex: 0,
    };
    expect(validateAiQuestion(q, { ...baseLive, change24h: 2.0 })).toBe(false);
  });

  it("passes when answer direction matches change24h", () => {
    const q = {
      stem: "BTC is rising today. How does Pyth deliver this price?",
      options: ["The dApp pulls it on-chain", "Pyth pushes it every block", "Chainlink relay", "Manual"],
      correctIndex: 0,
    };
    expect(validateAiQuestion(q, { ...baseLive, change24h: 1.5 })).toBe(true);
  });

  it("does not reject questions that mention confidence wording (no oracle CI in game snapshot)", () => {
    const q = {
      stem: "Is the oracle showing a tight confidence band right now?",
      options: ["Yes — tight and clear", "No — wide and uncertain", "Maybe", "Unknown"],
      correctIndex: 0,
    };
    expect(validateAiQuestion(q, baseLive)).toBe(true);
  });

  it("fails when quant question claims 400ms but answer says 1000ms", () => {
    const q = {
      stem: "How fast does Pyth update on Solana?",
      options: ["1000ms", "400ms", "5000ms", "100ms"],
      correctIndex: 0, // wrong answer index — answer is "1000ms"
    };
    expect(validateAiQuestion(q, baseLive)).toBe(false);
  });

  it("passes when quant question answer says 400ms", () => {
    const q = {
      stem: "How fast does Pyth update on Solana?",
      options: ["1000ms", "400ms", "5000ms", "100ms"],
      correctIndex: 1, // correct: "400ms"
    };
    expect(validateAiQuestion(q, baseLive)).toBe(true);
  });
});

describe("validateLiveTfNumericConsistency", () => {
  it("passes conceptual TF without % claims", () => {
    expect(
      validateLiveTfNumericConsistency("Pyth uses pull updates.", true, {
        symbol: "BTC/USD",
        price: 1,
        change24h: 2,
      }),
    ).toBe(true);
  });

  it("rejects TF when stem claims ~0.38% up but snapshot is ~0.85% up", () => {
    const live = {
      symbol: "BTC/USD",
      price: 1,
      change24h: 0.85,
    };
    expect(
      validateLiveTfNumericConsistency(
        "BTC/USD increased by approximately 0.38% over the window.",
        true,
        live,
      ),
    ).toBe(false);
  });
});

describe("validateMcqNumericReturnOption", () => {
  it("passes when options lack multiple % figures", () => {
    const q = {
      stem: "Oracle model?",
      options: ["Pull", "Push", "DNS", "Fax"],
      correctIndex: 0,
    };
    expect(
      validateMcqNumericReturnOption(q, {
        symbol: "ETH/USD",
        price: 1,
        change24h: 0.5,
      }),
    ).toBe(true);
  });

  it("requires correct option to be closest to snapshot return", () => {
    const q = {
      stem: "Return?",
      options: [
        "ETH rose about 0.50%",
        "ETH rose about 5.00%",
        "ETH fell about 0.50%",
        "ETH flat at 0%",
      ],
      correctIndex: 0,
    };
    expect(
      validateMcqNumericReturnOption(q, {
        symbol: "ETH/USD",
        price: 1,
        change24h: 0.52,
      }),
    ).toBe(true);
  });
});
