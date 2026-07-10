"use client";

// Login form - client component so we can drive the server action with
// React 19's `useActionState` and show inline pending/error states without a
// full page reload. The action itself (`login`) runs on the server only.
//
// Styled with the brand primitives: eyebrow labels, hairline-ringed inputs
// with an emerald focus ring, and the emerald pill button with a
// button-in-button trailing arrow.

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, CircleNotch } from "@phosphor-icons/react";

import { login, type LoginState } from "./actions";
import { Button } from "@/components/brand/button";
import { cn } from "@/lib/utils";

function Field({
  id,
  label,
  type,
  name,
  autoComplete,
  placeholder,
  autoFocus,
}: {
  id: string;
  label: string;
  type: string;
  name: string;
  autoComplete?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground"
      >
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required
        autoFocus={autoFocus}
        className={cn(
          "h-11 w-full rounded-xl bg-foreground/[0.04] px-3.5 text-[14px] text-foreground",
          "ring-1 ring-hairline transition-all duration-200 ease-soft",
          "placeholder:text-muted-foreground/55",
          "focus:bg-foreground/[0.06] focus:ring-emerald/60 focus:outline-none",
        )}
      />
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="primary-emerald"
      size="lg"
      className="mt-2 w-full"
      disabled={pending}
      trailingIcon={
        pending ? (
          <CircleNotch weight="light" className="size-3.5 animate-spin" />
        ) : (
          <ArrowRight weight="light" className="size-3.5" />
        )
      }
    >
      {pending ? "Signing in" : "Sign in"}
    </Button>
  );
}

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, formAction] = useActionState<LoginState, FormData>(
    login,
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <Field
        id="email"
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@binarycapital.in"
        autoFocus
      />

      <Field
        id="password"
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••••"
      />

      {state?.error ? (
        <p
          role="alert"
          className="rounded-lg bg-down/10 px-3 py-2 text-[12.5px] font-medium text-down ring-1 ring-down/25"
        >
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
