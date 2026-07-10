"use client";

// "New interaction" dialog - elevated to the double-bezel treatment. Submits a
// native form to the createInteraction server action via useActionState; on
// success the action redirects to the new interaction's detail page. Selects
// are styled-native <select>s (a11y + keyboard); values are mirrored into
// hidden inputs (project convention). Attendees are accumulated client-side
// and serialized to a hidden JSON field. zod validation + action are
// untouched - only the VIEW changed.

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
  SealWarning,
  Users,
  ArrowFatDown,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/brand/button";
import { Eyebrow } from "@/components/brand/text";
import {
  createInteraction,
  type CreateInteractionState,
} from "@/features/interactions/actions";

const CHANNELS = [
  "meeting",
  "call",
  "email",
  "whatsapp",
  "rfq",
  "ndsom_chat",
  "site_visit",
  "management_presentation",
] as const;

const DIRECTIONS = ["inbound", "outbound"] as const;

const ATTENDEE_ROLES = [
  "host",
  "chair",
  "presenter",
  "issuer_side",
  "investor_side",
  "advisor",
  "observer",
  "other",
] as const;

interface Attendee {
  contactId: string;
  name: string;
  roleAtMeeting: string;
}

export function NewInteractionDialog() {
  const [state, action, pending] = useActionState<CreateInteractionState, FormData>(
    createInteraction,
    undefined,
  );
  const [open, setOpen] = React.useState(false);
  const [channel, setChannel] = React.useState<string>("meeting");
  const [direction, setDirection] = React.useState<string>("outbound");
  const [attendees, setAttendees] = React.useState<Attendee[]>([]);
  const [attendeeContactId, setAttendeeContactId] = React.useState<string>("");
  const [attendeeRole, setAttendeeRole] = React.useState<string>("observer");

  function addAttendee() {
    if (!attendeeContactId) return;
    if (attendees.some((a) => a.contactId === attendeeContactId)) return;
    setAttendees((prev) => [
      ...prev,
      { contactId: attendeeContactId, name: "-", roleAtMeeting: attendeeRole },
    ]);
    setAttendeeContactId("");
  }

  function removeAttendee(contactId: string) {
    setAttendees((prev) => prev.filter((a) => a.contactId !== contactId));
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
            Log interaction
          </Button>
        }
      />
      <DialogContent
        className={cn(
          "max-h-[90vh] max-w-[600px] gap-0 overflow-y-auto rounded-[1.5rem] border-0 bg-transparent p-0 ring-0",
          "sm:max-w-[600px]",
        )}
      >
        <div className="rounded-[1.5rem] bg-white/[0.02] p-1.5 ring-1 ring-hairline shadow-floating">
          <div className="bezel-hi overflow-hidden rounded-[calc(1.5rem-0.375rem)] bg-surface">
            <form action={action} className="flex flex-col gap-6 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <Eyebrow dot>Engagement log</Eyebrow>
                  <DialogTitle className="text-[1.5rem] font-light tracking-[-0.02em] leading-tight text-foreground">
                    Log interaction
                  </DialogTitle>
                  <DialogDescription className="text-[13px] text-muted-foreground">
                    Record a meeting, call, or message. Anchor it to at least
                    one of a party, deal, or contact.
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
                <Field label="Subject" htmlFor="subject">
                  <BezelInput
                    id="subject"
                    name="subject"
                    placeholder="Q1 rating review call"
                  />
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Channel" htmlFor="channel">
                    <BezelSelect
                      id="channel"
                      name="channel"
                      value={channel}
                      onChange={setChannel}
                      options={CHANNELS}
                    />
                  </Field>
                  <Field label="Direction" htmlFor="direction">
                    <BezelSelect
                      id="direction"
                      name="direction"
                      value={direction}
                      onChange={setDirection}
                      options={DIRECTIONS}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Occurred at" htmlFor="occurredAt">
                    <BezelInput
                      id="occurredAt"
                      name="occurredAt"
                      type="datetime-local"
                    />
                  </Field>
                  <Field label="Duration (min)" htmlFor="durationMin">
                    <BezelInput
                      id="durationMin"
                      name="durationMin"
                      type="number"
                      min={0}
                      placeholder="30"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field label="Party ID" htmlFor="partyId" hint="uuid">
                    <BezelInput
                      id="partyId"
                      name="partyId"
                      placeholder="uuid"
                    />
                  </Field>
                  <Field label="Deal ID" htmlFor="dealId" hint="uuid">
                    <BezelInput id="dealId" name="dealId" placeholder="uuid" />
                  </Field>
                  <Field label="Contact ID" htmlFor="contactId" hint="uuid">
                    <BezelInput
                      id="contactId"
                      name="contactId"
                      placeholder="uuid"
                    />
                  </Field>
                </div>

                <Field label="Notes" htmlFor="body">
                  <BezelTextarea
                    id="body"
                    name="body"
                    rows={3}
                    placeholder="Discussion summary…"
                  />
                </Field>

                <Field label="Next action" htmlFor="nextAction">
                  <BezelInput
                    id="nextAction"
                    name="nextAction"
                    placeholder="Send term sheet by Fri"
                  />
                </Field>

                {/* Attendees - accumulated client-side, serialized as JSON. */}
                <div className="flex flex-col gap-3 rounded-2xl bg-foreground/[0.02] p-4 ring-1 ring-hairline/60">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      <Users weight="light" className="size-3.5" />
                      Attendees
                    </span>
                    <span className="nums text-[11px] text-muted-foreground/70">
                      {attendees.length} added
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="flex flex-1 flex-col gap-1.5">
                      <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                        Contact ID
                      </span>
                      <BezelInput
                        value={attendeeContactId}
                        onChange={(e) => setAttendeeContactId(e.target.value)}
                        placeholder="contact uuid"
                      />
                    </div>
                    <div className="flex w-full flex-col gap-1.5 sm:w-40">
                      <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                        Role
                      </span>
                      <BezelSelect
                        value={attendeeRole}
                        onChange={setAttendeeRole}
                        options={ATTENDEE_ROLES}
                        name="attendeeRole"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary-hairline"
                      size="md"
                      onClick={addAttendee}
                      leadingIcon={<Plus weight="light" className="size-4" />}
                    >
                      Add
                    </Button>
                  </div>
                  {attendees.length > 0 ? (
                    <ul className="flex flex-col gap-1.5">
                      {attendees.map((a) => (
                        <li
                          key={a.contactId}
                          className="flex items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2 text-[12px] ring-1 ring-hairline/50"
                        >
                          <span className="inline-flex items-center gap-2 truncate">
                            <span className="nums truncate text-foreground/80">
                              {a.contactId}
                            </span>
                            <span className="text-muted-foreground/70">
                              · {a.roleAtMeeting.replace(/_/g, " ")}
                            </span>
                          </span>
                          <button
                            type="button"
                            className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition-all duration-200 ease-soft hover:bg-down/10 hover:text-down active:scale-[0.96]"
                            onClick={() => removeAttendee(a.contactId)}
                            aria-label="Remove attendee"
                          >
                            <X weight="light" className="size-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <input
                    type="hidden"
                    name="attendees"
                    value={JSON.stringify(
                      attendees.map(({ contactId, roleAtMeeting }) => ({
                        contactId,
                        roleAtMeeting,
                      })),
                    )}
                  />
                </div>

                <label className="inline-flex cursor-pointer items-center gap-3 rounded-xl bg-foreground/[0.02] px-3.5 py-3 ring-1 ring-hairline/60 transition-all duration-200 ease-soft hover:ring-hairline">
                  <span className="relative inline-flex size-4 items-center justify-center">
                    <input
                      type="checkbox"
                      name="containsMnpi"
                      className="peer size-4 appearance-none rounded-[5px] bg-foreground/[0.06] ring-1 ring-hairline transition-all duration-200 ease-soft checked:bg-down checked:ring-down/60"
                    />
                    <SealWarning
                      weight="light"
                      className="pointer-events-none absolute size-3 text-on-emerald opacity-0 transition-opacity duration-200 peer-checked:opacity-100"
                    />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-[13px] font-medium text-foreground">
                      Contains MNPI
                    </span>
                    <span className="text-[11.5px] text-muted-foreground">
                      Walls this interaction from trading desks.
                    </span>
                  </span>
                </label>
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
                  {pending ? "Logging…" : "Log interaction"}
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