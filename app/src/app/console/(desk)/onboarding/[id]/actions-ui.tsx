"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  advanceStage,
  approveCompliance,
  activateClient,
} from "@/features/onboarding/actions";
import { CButton } from "@/console/primitives/button";

const NEXT: Record<string, string | null> = {
  initiated: "profile_created",
  profile_created: "documents_collected",
  documents_collected: "kyc_verified",
  kyc_verified: "compliance_approved",
  compliance_approved: "active",
  active: null,
};

export function OnboardingActions({
  partyId,
  stage,
}: {
  partyId: string;
  stage: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const next = NEXT[stage] ?? null;

  function run(fn: () => Promise<unknown>) {
    start(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {next && next !== "active" && next !== "compliance_approved" ? (
        <CButton
          type="button"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const fd = new FormData();
              fd.set("partyId", partyId);
              fd.set("to", next);
              await advanceStage(undefined, fd);
            })
          }
        >
          Advance to {next.replace(/_/g, " ")}
        </CButton>
      ) : null}
      {stage === "kyc_verified" || stage === "documents_collected" ? (
        <CButton
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const fd = new FormData();
              fd.set("partyId", partyId);
              await approveCompliance(undefined, fd);
            })
          }
        >
          Approve compliance
        </CButton>
      ) : null}
      {stage === "compliance_approved" ? (
        <CButton
          type="button"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const fd = new FormData();
              fd.set("partyId", partyId);
              await activateClient(undefined, fd);
            })
          }
        >
          Activate client
        </CButton>
      ) : null}
      {stage === "active" ? (
        <p className="text-[12px] text-[var(--c-ok)]">Client is active.</p>
      ) : null}
    </div>
  );
}
