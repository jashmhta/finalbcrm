"use client";

// Inline status-change control for a task - elevated to the bezel-select
// treatment. Uses the updateTaskStatus server action via useActionState. The
// current status is reflected in the styled native <select>; the value is
// mirrored into a hidden input so FormData carries it. zod validation +
// action untouched - only the VIEW changed.

import * as React from "react";
import { useActionState } from "react";
import { ArrowFatDown, CircleNotch } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/brand/button";
import {
  updateTaskStatus,
  type UpdateTaskStatusState,
} from "@/features/tasks/actions";

export function TaskStatusForm({
  taskId,
  current,
  statuses,
}: {
  taskId: string;
  current: string;
  statuses: string[];
}) {
  const [state, action, pending] = useActionState<UpdateTaskStatusState, FormData>(
    updateTaskStatus,
    undefined,
  );
  const [status, setStatus] = React.useState<string>(current);

  return (
    <form action={action} className="flex items-center gap-2.5">
      <input type="hidden" name="taskId" value={taskId} />
      <div className="group/field relative inline-flex items-center rounded-full bg-foreground/[0.02] p-px ring-1 ring-hairline/70 transition-all duration-200 ease-soft focus-within:ring-hairline">
        <div className="relative flex items-center rounded-full bg-surface">
          <select
            aria-label="Task status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={cn(
              "h-9 w-full appearance-none rounded-full bg-transparent pl-3.5 pr-8 text-[12.5px] font-medium text-foreground",
              "focus:outline-none",
            )}
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <ArrowFatDown
            aria-hidden
            weight="light"
            className="pointer-events-none absolute right-3 size-3 text-muted-foreground"
          />
        </div>
        <input type="hidden" name="status" value={status} />
      </div>
      <Button
        type="submit"
        size="sm"
        variant="primary-emerald"
        disabled={pending}
        leadingIcon={
          pending ? (
            <CircleNotch weight="light" className="size-4 animate-spin" />
          ) : undefined
        }
      >
        {pending ? "Saving…" : "Update status"}
      </Button>
      {state?.error ? (
        <span className="text-[11.5px] font-medium text-down">{state.error}</span>
      ) : null}
    </form>
  );
}