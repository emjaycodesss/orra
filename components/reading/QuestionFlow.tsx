"use client";

import { useState, useCallback } from "react";
import { AssetSearch } from "@/components/dashboard/AssetSearch";

export interface OracleAnswers {
  realm: string;
  realmFeedId: number;
  realmSymbol: string;
  stance: string;
  truth: string;
}

interface Props {
  onComplete: (answers: OracleAnswers) => void;
}

const STANCES = [
  { value: "hold", label: "I hold this realm" },
  { value: "considering", label: "I am considering entry" },
  { value: "sold", label: "I have departed" },
  { value: "curious", label: "I am merely curious" },
  { value: "afraid", label: "I am afraid" },
];

const TRUTHS = [
  { value: "what lies ahead this hour", label: "What lies ahead this hour?" },
  { value: "what the week will bring", label: "What will this week bring?" },
  { value: "the shape of the month to come", label: "What shape has the month?" },
  { value: "whether to act or wait", label: "Should I act or wait?" },
  { value: "what I cannot see", label: "What am I not seeing?" },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-10">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-0.5 rounded-full transition-all duration-500"
          style={{
            width: i === current ? 32 : 16,
            backgroundColor: i <= current ? "var(--accent)" : "var(--surface-4)",
          }} />
      ))}
    </div>
  );
}

export function QuestionFlow({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<OracleAnswers>>({});

  const handleRealmSelect = useCallback((feedId: number, symbol: string, name: string) => {
    setAnswers((prev) => ({ ...prev, realm: name, realmFeedId: feedId, realmSymbol: symbol }));
    setStep(1);
  }, []);

  const handleStance = useCallback((stance: string) => {
    setAnswers((prev) => ({ ...prev, stance }));
    setStep(2);
  }, []);

  const handleTruth = useCallback((truth: string) => {
    const final = { ...answers, truth } as OracleAnswers;
    setAnswers(final);
    onComplete(final);
  }, [answers, onComplete]);

  return (
    <div className="w-full max-w-md mx-auto opacity-0 animate-fade-up">
      <StepIndicator current={step} />

      {step === 0 && (
        <div className="flex flex-col gap-6">
          <h2 className="text-[20px] font-light text-ink-900 leading-relaxed">
            What realm do you wish the oracle to gaze upon?
          </h2>
          <AssetSearch onSelect={handleRealmSelect} />
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-6 opacity-0 animate-fade-up">
          <h2 className="text-[20px] font-light text-ink-900 leading-relaxed">
            How do you stand before this realm?
          </h2>
          <div className="flex flex-col gap-1.5">
            {STANCES.map((s, i) => (
              <button key={s.value} onClick={() => handleStance(s.value)}
                className="w-full px-4 py-3.5 text-left text-[13px] font-medium text-ink-700 card-surface opacity-0"
                style={{ animation: `fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 0.05}s forwards` }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-6 opacity-0 animate-fade-up">
          <h2 className="text-[20px] font-light text-ink-900 leading-relaxed">
            What truth do you seek?
          </h2>
          <div className="flex flex-col gap-1.5">
            {TRUTHS.map((t, i) => (
              <button key={t.value} onClick={() => handleTruth(t.value)}
                className="w-full px-4 py-3.5 text-left text-[13px] font-medium text-ink-700 card-surface opacity-0"
                style={{ animation: `fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 0.05}s forwards` }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
