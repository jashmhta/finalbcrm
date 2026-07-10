"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, CircleNotch } from "@phosphor-icons/react";

import { consoleLogin, type ConsoleLoginState } from "./actions";
import { CButton } from "@/console/primitives/button";
import { CInput } from "@/console/primitives/input";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <CButton type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <CircleNotch className="size-4 animate-spin" />
          Signing in…
        </>
      ) : (
        <>
          Sign in
          <span className="flex size-7 items-center justify-center rounded-full bg-white/15">
            <ArrowRight className="size-3.5" weight="bold" />
          </span>
        </>
      )}
    </CButton>
  );
}

export function ConsoleLoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, action] = useActionState<ConsoleLoginState, FormData>(
    consoleLogin,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      {callbackUrl ? (
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
      ) : null}
      <CInput
        label="Work email"
        name="email"
        type="email"
        autoComplete="username"
        placeholder="you@binarycapital.in"
        autoFocus
        required
      />
      <CInput
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      {/* Keep TOTP out of autofill so password managers don't poison MFA */}
      <CInput
        label="Authenticator code (optional)"
        name="totp"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="Leave blank"
        hint="Only if your admin enrolled MFA. Seed accounts leave this empty."
      />
      {state?.error ? (
        <p
          className="rounded-[var(--c-radius)] bg-[var(--c-bad-bg)] px-3 py-2 text-[13px] text-[var(--c-bad)]"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      <p className="rounded-[var(--c-radius)] bg-[var(--c-accent-soft)] px-3 py-2 text-[12px] leading-relaxed text-[var(--c-ink-2)]">
        <span className="font-medium text-[var(--c-ink)]">Demo access</span>
        <br />
        Email{" "}
        <span className="font-mono text-[var(--c-ink)]">
          shray@binarycapital.in
        </span>
        <br />
        Password{" "}
        <span className="font-mono text-[var(--c-ink)]">BinaryCrm!2026</span>
      </p>
      <SubmitButton />
    </form>
  );
}
