"use client";

// "New task" dialog - elevated to the double-bezel treatment. Submits a
// native form to the createTask server action via useActionState; on success
// the action redirects to the new task's detail page. Dependency edges are
// accumulated client-side and serialized to a hidden JSON array of task UUIDs.
// zod validation + action untouched - only the VIEW changed.

import * as React from "react";
import { useActionState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  X,
  Plus,
  ArrowRight,
  CircleNotch,
  ArrowFatDown,
  LinkBreak,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/brand/button";
import { Eyebrow } from "@/components/brand/text";
import { createTask, type CreateTaskState } from "@/features/tasks/actions";

const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export function NewTaskDialog() {
  const [state, action, pending] = useActionState<CreateTaskState, FormData>(
    createTask,
    undefined,
  );
  const [open, setOpen] = React.useState(false);
  const [priority, setPriority] = React.useState<string>("medium");
  const [depIds, setDepIds] = React.useState<string[]>([]);
  const [depInput, setDepInput] = React.useState("");

  function addDep() {
    const v = depInput.trim();
    if (!v) return;
    if (depIds.includes(v)) return;
    setDepIds((prev) => [...prev, v]);
    setDepInput("");
  }

  function removeDep(id: string) {
    setDepIds((prev) => prev.filter((x) => x !== id));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="primary-emerald"
            size="md"
            leadingIcon={<Plus weight="light" className="size-4" />}
          >
            New task
          </Button>
        }
      />
      <DialogContent
        className={cn(
          "max-h-[90vh] max-w-[560px] gap-0 overflow-y-auto rounded-[1.5rem] border-0 bg-transparent p-0 ring-0",
          "sm:max-w-[560px]",
        )}
      >
        <div className="rounded-[1.5rem] bg-white/[0.02] p-1.5 ring-1 ring-hairline shadow-floating">
          <div className="bezel-hi overflow-hidden rounded-[calc(1.5rem-0.375rem)] bg-surface">
            <form action={action} className="flex flex-col gap-6 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <Eyebrow dot>Worklist</Eyebrow>
                  <DialogTitle className="text-[1.5rem] font-light tracking-[-0.02em] leading-tight text-foreground">
                    New task
                  </DialogTitle>
                  <DialogDescription className="text-[13px] text-muted-foreground">
                    Create a task with a due date, assignee, and optional
                    dependencies.
                  </DialogDescription>
                </div>
                <DialogClose
                  render={
                    <button
                      type="button"
                      aria-label="Close"
                      className={cn(
                        "inline-flex size-8 items-center justify-center rounded-full",
                        "text-muted-foreground ring-1 ring-hairline transition-all duration-200 ease-soft",
                        "hover:bg-foreground/5 hover:text-foreground active:scale-[0.96]",
                      )}
                    />
                  }
                >
                  <X weight="light" className="size-4" />
                </DialogClose>
              </div>

              <div className="flex flex-col gap-4">
                <Field label="Title" htmlFor="title" required>
                  <BezelInput
                    id="title"
                    name="title"
                    required
                    placeholder="Coordinate agency rating meeting"
                  />
                </Field>

                <Field label="Description" htmlFor="description">
                  <BezelTextarea
                    id="description"
                    name="description"
                    rows={3}
                    placeholder="What needs to happen, context, links…"
                  />
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Due date" htmlFor="dueDate">
                    <BezelInput id="dueDate" name="dueDate" type="date" />
                  </Field>
                  <Field label="Priority" htmlFor="priority">
                    <BezelSelect
                      id="priority"
                      name="priority"
                      value={priority}
                      onChange={setPriority}
                      options={PRIORITIES}
                    />
                  </Field>
                </div>

                <Field
                  label="Assignee (user ID)"
                  htmlFor="assigneeUserId"
                  hint="uuid"
                >
                  <BezelInput
                    id="assigneeUserId"
                    name="assigneeUserId"
                    placeholder="app_user uuid"
                  />
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Deal ID" htmlFor="dealId" hint="optional">
                    <BezelInput id="dealId" name="dealId" placeholder="uuid" />
                  </Field>
                  <Field label="Party ID" htmlFor="partyId" hint="optional">
                    <BezelInput id="partyId" name="partyId" placeholder="uuid" />
                  </Field>
                </div>

                {/* Dependencies - accumulated client-side, serialized as JSON. */}
                <div className="flex flex-col gap-3 rounded-2xl bg-foreground/[0.02] p-4 ring-1 ring-hairline/60">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      <LinkBreak weight="light" className="size-3.5" />
                      Depends on
                    </span>
                    <span className="nums text-[11px] text-muted-foreground/70">
                      {depIds.length} edges
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="flex flex-1 flex-col gap-1.5">
                      <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                        Task ID
                      </span>
                      <BezelInput
                        value={depInput}
                        onChange={(e) => setDepInput(e.target.value)}
                        placeholder="task uuid"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary-hairline"
                      size="md"
                      onClick={addDep}
                      leadingIcon={<Plus weight="light" className="size-4" />}
                    >
                      Add
                    </Button>
                  </div>
                  {depIds.length > 0 ? (
                    <ul className="flex flex-col gap-1.5">
                      {depIds.map((id) => (
                        <li
                          key={id}
                          className="flex items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2 text-[12px] ring-1 ring-hairline/50"
                        >
                          <span className="nums truncate text-foreground/80">
                            {id}
                          </span>
                          <button
                            type="button"
                            className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition-all duration-200 ease-soft hover:bg-down/10 hover:text-down active:scale-[0.96]"
                            onClick={() => removeDep(id)}
                            aria-label="Remove dependency"
                          >
                            <X weight="light" className="size-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <input
                    type="hidden"
                    name="dependsOnTaskIds"
                    value={JSON.stringify(depIds)}
                  />
                </div>
              </div>

              {state?.error ? (
                <p
                  role="alert"
                  className="rounded-xl bg-down/10 px-3.5 py-2.5 text-[12.5px] font-medium text-down ring-1 ring-down/25"
                >
                  {state.error}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2.5 border-t border-hairline pt-5">
                <DialogClose
                  render={
                    <Button variant="ghost" size="md" type="button">
                      Cancel
                    </Button>
                  }
                />
                <Button
                  type="submit"
                  variant="primary-gold"
                  size="md"
                  disabled={pending}
                  leadingIcon={
                    pending ? (
                      <CircleNotch weight="light" className="size-4 animate-spin" />
                    ) : undefined
                  }
                  trailingIcon={
                    pending ? undefined : (
                      <ArrowRight weight="light" className="size-4" />
                    )
                  }
                >
                  {pending ? "Creating…" : "Create task"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  required,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
      >
        {label}
        {required ? <span className="text-gold">*</span> : null}
        {hint ? (
          <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground/70">
            {hint}
          </span>
        ) : null}
      </label>
      {children}
    </div>
  );
}

function BezelInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="group/field rounded-xl bg-foreground/[0.02] p-px ring-1 ring-hairline/70 transition-all duration-200 ease-soft focus-within:ring-hairline">
      <input
        {...props}
        className={cn(
          "h-10 w-full rounded-[calc(0.75rem-1px)] bg-surface px-3.5 text-[13.5px] text-foreground",
          "placeholder:text-muted-foreground/60 focus:outline-none",
          className,
        )}
      />
    </div>
  );
}

function BezelTextarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="group/field rounded-xl bg-foreground/[0.02] p-px ring-1 ring-hairline/70 transition-all duration-200 ease-soft focus-within:ring-hairline">
      <textarea
        {...props}
        className={cn(
          "w-full rounded-[calc(0.75rem-1px)] bg-surface px-3.5 py-2.5 text-[13.5px] leading-[1.55] text-foreground",
          "placeholder:text-muted-foreground/60 focus:outline-none",
          className,
        )}
      />
    </div>
  );
}

function BezelSelect({
  id,
  name,
  value,
  onChange,
  options,
}: {
  id?: string;
  name?: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <div className="group/field rounded-xl bg-foreground/[0.02] p-px ring-1 ring-hairline/70 transition-all duration-200 ease-soft focus-within:ring-hairline">
      <div className="relative flex items-center rounded-[calc(0.75rem-1px)] bg-surface">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-10 w-full appearance-none rounded-[calc(0.75rem-1px)] bg-transparent px-3.5 pr-8 text-[13.5px] text-foreground",
            "focus:outline-none",
          )}
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <ArrowFatDown
          aria-hidden
          weight="light"
          className="pointer-events-none absolute right-3 size-3 text-muted-foreground"
        />
      </div>
      {name ? <input type="hidden" name={name} value={value} /> : null}
    </div>
  );
}