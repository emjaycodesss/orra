"use client";

import { useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { ethers } from "ethers";
import { Navbar } from "@/components/shared/Navbar";
import { WalletButton } from "@/components/shared/WalletButton";
import { QuestionFlow, type OracleAnswers } from "@/components/reading/QuestionFlow";
import { CardReveal } from "@/components/reading/CardReveal";
import { Interpretation } from "@/components/reading/Interpretation";
import { EntropyProof } from "@/components/reading/EntropyProof";
import { useOrraContract } from "@/hooks/useOrraContract";
import { usePythStream } from "@/hooks/usePythStream";
import { useWeatherState } from "@/hooks/useWeatherState";
import { MAJOR_ARCANA } from "@/lib/cards";
import { buildMessages } from "@/lib/prompt";

type ReadingPhase = "questions" | "connect" | "confirm" | "waiting" | "revealed";

export default function ReadingPage() {
  const [phase, setPhase] = useState<ReadingPhase>("questions");
  const [answers, setAnswers] = useState<OracleAnswers | null>(null);
  const [interpretation, setInterpretation] = useState("");
  const { isConnected } = useAccount();
  const contract = useOrraContract();

  const feedId = answers?.realmFeedId ?? 1;
  const rawPyth = usePythStream(feedId);
  const weather = useWeatherState(rawPyth);

  const handleQuestionsComplete = useCallback(
    (a: OracleAnswers) => {
      setAnswers(a);
      if (isConnected) { setPhase("confirm"); contract.fetchFee(); }
      else { setPhase("connect"); }
    },
    [isConnected, contract]
  );

  const handleConfirm = useCallback(async () => {
    setPhase("waiting");
    try {
      const provider = new ethers.BrowserProvider(
        (window as unknown as { ethereum: ethers.Eip1193Provider }).ethereum
      );
      const signer = await provider.getSigner();
      await contract.requestReading(signer);
    } catch { /* handled by contract store */ }
  }, [contract]);

  const handleReveal = useCallback(async () => {
    if (contract.cardIndex === null || !answers) return;
    setPhase("revealed");
    const card = MAJOR_ARCANA[contract.cardIndex];
    if (!card) return;

    const promptBody = buildMessages({
      card, weather,
      questions: { realm: answers.realm, stance: answers.stance, truth: answers.truth },
    });

    try {
      const res = await fetch("/api/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(promptBody),
      });
      if (res.ok) {
        const data = await res.json();
        setInterpretation(data.interpretation ?? "");
      }
    } catch { setInterpretation("The oracle falls silent. Try again."); }
  }, [contract.cardIndex, answers, weather]);

  if (contract.status === "revealed" && phase === "waiting") { handleReveal(); }

  const feeDisplay = contract.fee ? `${ethers.formatEther(contract.fee)} ETH` : "--";

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-14">
        <div className="max-w-5xl mx-auto px-6 py-16 flex flex-col items-center gap-10">
          {phase === "questions" && <QuestionFlow onComplete={handleQuestionsComplete} />}

          {phase === "connect" && (
            <div className="flex flex-col items-center gap-8 max-w-sm opacity-0 animate-fade-up">
              <h2 className="text-[20px] font-light text-ink-900 text-center leading-relaxed">
                The oracle requires a connection to the chain
              </h2>
              <p className="text-[12px] font-medium text-ink-400 text-center leading-relaxed">
                Connect your wallet on Base to draw a card from the Entropy oracle.
                The reading fee is paid in ETH.
              </p>
              <WalletButton />
              {isConnected && (
                <button onClick={() => { setPhase("confirm"); contract.fetchFee(); }} className="btn-push">
                  <span className="btn-shadow" />
                  <span className="btn-edge" />
                  <span className="btn-front !text-[12px] uppercase tracking-widest">proceed</span>
                </button>
              )}
            </div>
          )}

          {phase === "confirm" && (
            <div className="flex flex-col items-center gap-8 max-w-sm opacity-0 animate-fade-up">
              <h2 className="text-[20px] font-light text-ink-900 text-center">
                The oracle awaits your offering
              </h2>
              <div className="card-surface px-8 py-5 text-center">
                <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-ink-400 mb-2">reading fee</p>
                <p className="text-[28px] font-extralight text-ink-900 tabular">{feeDisplay}</p>
              </div>
              <button onClick={handleConfirm} className="btn-push">
                <span className="btn-shadow" />
                <span className="btn-edge" />
                <span className="btn-front !text-[12px] uppercase tracking-widest">draw the card</span>
              </button>
              <WalletButton />
            </div>
          )}

          {phase === "waiting" && contract.status !== "revealed" && (
            <div className="flex flex-col items-center gap-6 opacity-0 animate-fade-up">
              <h2 className="text-[20px] font-light text-ink-900 text-center">
                {contract.status === "requesting"
                  ? "Sending your offering..."
                  : contract.status === "waiting"
                    ? "The oracle draws your card..."
                    : contract.status === "error"
                      ? "The oracle encountered an error"
                      : contract.status === "timeout"
                        ? "The oracle is slow to respond"
                        : "Preparing..."}
              </h2>
              {(contract.status === "requesting" || contract.status === "waiting") && (
                <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin-slow" />
              )}
              {contract.error && (
                <p className="text-[12px] font-medium text-storm text-center max-w-sm">{contract.error}</p>
              )}
            </div>
          )}

          {phase === "revealed" && contract.cardIndex !== null && (
            <div className="flex flex-col items-center gap-10">
              <CardReveal cardIndex={contract.cardIndex} />
              <Interpretation text={interpretation} />
              <EntropyProof sequenceNumber={contract.sequenceNumber} />
            </div>
          )}
        </div>
      </main>
    </>
  );
}
