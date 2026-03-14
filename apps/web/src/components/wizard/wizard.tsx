"use client";

import { useState } from "react";
import { useSession } from "@/lib/session";
import { UserTypeStep } from "./user-type-step";
import { WalletsStep } from "./wallets-step";
import { GroupsStep } from "./groups-step";
import { cn } from "@/lib/utils";

const steps = [
  { id: 1, name: "User Type", description: "Select entity type" },
  { id: 2, name: "Wallets", description: "Add addresses" },
  { id: 3, name: "Groups", description: "Organize wallets" },
];

interface WizardProps {
  onComplete: () => void;
}

export function Wizard({ onComplete }: WizardProps) {
  const { session } = useSession();

  // Determine initial step based on session state
  const getInitialStep = () => {
    if (!session.userType) return 1;
    if (session.wallets.length === 0) return 2;
    return 3;
  };

  const [currentStep, setCurrentStep] = useState(getInitialStep);

  const goToNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const goToPrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="space-y-8">
      {/* Progress indicator */}
      <div className="flex items-center">
        {steps.map((step, index) => (
          <div key={step.id} className={cn("flex items-center", index < steps.length - 1 ? "flex-1" : "")}>
            <div className="flex items-center flex-shrink-0">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center font-mono text-sm transition-colors flex-shrink-0",
                  currentStep > step.id
                    ? "bg-green-500/20 text-green-400 border border-green-500/50"
                    : currentStep === step.id
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/50"
                    : "bg-neutral-800 text-neutral-500 border border-neutral-700"
                )}
              >
                {currentStep > step.id ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step.id
                )}
              </div>
              <div className="ml-3 hidden sm:block">
                <p
                  className={cn(
                    "text-sm font-medium",
                    currentStep >= step.id ? "text-neutral-200" : "text-neutral-500"
                  )}
                >
                  {step.name}
                </p>
                <p className="text-xs text-neutral-500">{step.description}</p>
              </div>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-2 sm:mx-4",
                  currentStep > step.id ? "bg-green-500/50" : "bg-neutral-700"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 sm:p-8">
        {currentStep === 1 && <UserTypeStep onNext={goToNext} />}
        {currentStep === 2 && <WalletsStep onNext={goToNext} onBack={goToPrevious} />}
        {currentStep === 3 && <GroupsStep onNext={onComplete} onBack={goToPrevious} />}
      </div>
    </div>
  );
}
