"use client";

import { useActionState } from "react";
import { createTask, type CreateTaskState } from "@/features/tasks/actions";
import { CInput } from "@/console/primitives/input";
import { CButton } from "@/console/primitives/button";

export function NewTaskForm() {
  const [state, action, pending] = useActionState(
    createTask,
    undefined as CreateTaskState,
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="redirectTo" value="/console/tasks" />
      <CInput label="Title" name="title" required maxLength={200} />
      <CInput label="Description" name="description" />
      <CInput label="Due date" name="dueDate" type="date" />
      <label className="flex flex-col gap-1 text-[12px] font-medium text-[var(--c-ink-2)]">
        Priority
        <select
          name="priority"
          defaultValue="medium"
          className="h-10 rounded-[var(--c-radius)] px-2 ring-1 ring-[var(--c-line-strong)]"
        >
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
          <option value="urgent">urgent</option>
        </select>
      </label>
      {state?.error ? (
        <p className="text-[12px] text-[var(--c-bad)]">{state.error}</p>
      ) : null}
      <CButton type="submit" disabled={pending} className="w-full">
        {pending ? "Creating…" : "Create task"}
      </CButton>
    </form>
  );
}
