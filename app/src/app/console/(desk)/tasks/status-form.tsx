"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTaskStatus } from "@/features/tasks/actions";
import { revalidateConsole } from "@/console/actions/revalidate";

export function TaskStatusForm({
  taskId,
  status,
}: {
  taskId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <select
      className="h-8 rounded-[var(--c-radius-sm)] bg-[var(--c-surface)] px-2 text-[12px] ring-1 ring-[var(--c-line-strong)]"
      defaultValue={status}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        start(async () => {
          const fd = new FormData();
          fd.set("taskId", taskId);
          fd.set("status", next);
          await updateTaskStatus(undefined, fd);
          await revalidateConsole(["/console/tasks"]);
          router.refresh();
        });
      }}
    >
      <option value="pending">pending</option>
      <option value="in_progress">in_progress</option>
      <option value="completed">completed</option>
      <option value="blocked">blocked</option>
      <option value="cancelled">cancelled</option>
      <option value="deferred">deferred</option>
    </select>
  );
}
