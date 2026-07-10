"use client";

import { useState, useTransition } from "react";
import { runIntegrationMock } from "@/features/integrations/actions";
import { CButton } from "@/console/primitives/button";

export function RunIntegrationButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="mt-auto flex flex-col gap-1 pt-2">
      <CButton
        type="button"
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await runIntegrationMock({ id });
            setMsg(res.ok ? res.summary : res.error ?? "Failed");
          })
        }
      >
        {pending ? "Running…" : "Run mock"}
      </CButton>
      {msg ? (
        <p className="text-[11px] text-[var(--c-ink-3)] line-clamp-2">{msg}</p>
      ) : null}
    </div>
  );
}
