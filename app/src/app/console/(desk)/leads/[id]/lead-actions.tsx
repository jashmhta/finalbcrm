"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  convertToOpportunity,
  winLead,
  loseLead,
} from "@/features/leads/actions";
import { CButton } from "@/console/primitives/button";

export function LeadActions({
  partyId,
  stage,
  canWrite,
  convertedDealId,
}: {
  partyId: string;
  stage: string;
  canWrite: boolean;
  convertedDealId?: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (!canWrite) {
    return (
      <p className="text-[12px] text-[var(--c-ink-3)]">
        Read-only - you cannot advance this lead.
      </p>
    );
  }

  function run(fn: () => Promise<unknown>) {
    start(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {stage === "new" || stage === "qualified" ? (
        <CButton
          type="button"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const fd = new FormData();
              fd.set("partyId", partyId);
              await convertToOpportunity(undefined, fd);
            })
          }
        >
          Convert to opportunity
        </CButton>
      ) : null}
      {stage === "opportunity" || stage === "qualified" ? (
        <CButton
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const fd = new FormData();
              fd.set("partyId", partyId);
              const res = await winLead(undefined, fd);
              if (res && "ok" in res && res.ok && res.dealId) {
                router.push(`/console/deals/${res.dealId}`);
                return;
              }
              router.refresh();
            })
          }
        >
          Mark won (create deal)
        </CButton>
      ) : null}
      {stage !== "won" && stage !== "lost" ? (
        <CButton
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const fd = new FormData();
              fd.set("partyId", partyId);
              // Must match LOSS_REASONS / LEAD_LOSS_REASONS enum in leads actions.
              fd.set("lossReason", "other");
              await loseLead(undefined, fd);
            })
          }
        >
          Mark lost
        </CButton>
      ) : null}
      {stage === "won" && convertedDealId ? (
        <CButton
          type="button"
          onClick={() => router.push(`/console/deals/${convertedDealId}`)}
        >
          Open mandate
        </CButton>
      ) : null}
      {stage === "won" && !convertedDealId ? (
        <p className="text-[12px] text-[var(--c-ok)]">Won - deal created.</p>
      ) : null}
    </div>
  );
}
