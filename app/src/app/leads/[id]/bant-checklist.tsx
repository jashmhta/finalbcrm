"use client";

import * as React from "react";
import { useActionState } from "react";
import { motion } from "framer-motion";
import {
  CurrencyInr,
  Crown,
  Target,
  Clock,
  SealCheck,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { updateBant, type UpdateBantState } from "@/features/leads/actions";
// Constants + types from `./types` directly - NOT the feature barrel (which
// re-exports ./queries → postgres → breaks the "use client" bundle).
import {
  BANT_CRITERIA,
  BANT_HINTS,
  BANT_LABELS,
  isQualified,
  type BantCriterion,
  type BantQualification,
} from "@/features/leads/types";

/* ------------------------------------------------------------------ *
 * BantChecklist - the qualification checklist as toggle chips.
 *
 * Each criterion is a tappable chip (44px min) that flips its BANT boolean
 * via the updateBant server action. The action auto-promotes a fully-
 * qualified 'new' lead to 'qualified', so the funnel reflects the
 * qualification without a separate action. A progress ring + the "qualified"
 * banner close the loop visually.
 * ------------------------------------------------------------------ */

const EASE = [0.32, 0.72, 0, 1] as const;

const CRITERION_META: Record<
  BantCriterion,
  { icon: React.ReactNode; hint: string }
> = {
  budget: {
    icon: <CurrencyInr weight="light" className="size-4" />,
    hint: BANT_HINTS.budget,
  },
  authority: {
    icon: <Crown weight="light" className="size-4" />,
    hint: BANT_HINTS.authority,
  },
  need: {
    icon: <Target weight="light" className="size-4" />,
    hint: BANT_HINTS.need,
  },
  timeline: {
    icon: <Clock weight="light" className="size-4" />,
    hint: BANT_HINTS.timeline,
  },
};

export function BantChecklist({
  partyId,
  initialBant,
  readOnly,
}: {
  partyId: string;
  initialBant: BantQualification;
  /** Won/Lost leads are closed - BANT is locked. */
  readOnly?: boolean;
}) {
  // Local mirror of the BANT state so toggles feel instant; the server action
  // revalidates the page and the canonical state flows back on next nav.
  const [bant, setBant] = React.useState<BantQualification>(initialBant);
  const [state, action, pending] = useActionState<UpdateBantState, FormData>(
    updateBant,
    undefined,
  );

  // Sync from server-revalidated props when the page refreshes after a toggle.
  React.useEffect(() => {
    setBant(initialBant);
  }, [initialBant]);

  const score = BANT_CRITERIA.reduce(
    (acc, c) => acc + Number(bant[c]),
    0,
  );
  const qualified = isQualified(bant);

  function toggle(criterion: BantCriterion) {
    if (readOnly || pending) return;
    const next = { ...bant, [criterion]: !bant[criterion] } as BantQualification;
    setBant(next); // optimistic
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Progress + qualified banner */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BantRing score={score} qualified={qualified} />
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-medium text-foreground">
              {score}/4 criteria met
            </span>
            <span className="text-[11.5px] text-muted-foreground">
              {qualified
                ? "Fully qualified - ready to convert."
                : "Clear all four to qualify the lead."}
            </span>
          </div>
        </div>
        {qualified ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald/[0.08] px-3 py-1.5 text-[12px] font-medium text-emerald ring-1 ring-emerald/25">
            <SealCheck weight="light" className="size-4" />
            Qualified
          </span>
        ) : null}
      </div>

      {/* Chips - each criterion is its own <form>. React 19 overrides the
          `name` prop on a button that carries a function `formAction`, so a
          single shared form with `<button name="criterion" formAction={fn}>`
          strips `criterion` from the formData and the action can't tell which
          chip was tapped. Per-criterion forms with a hidden
          `<input name="criterion">` (a sibling of the button, not nested in
          it) give the action its partyId + criterion unambiguously every
          time. The `value` input is intentionally omitted - the action
          toggles from the authoritative DB state (see actions.ts), so the
          form never needs to carry the next value. */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {BANT_CRITERIA.map((c) => {
          const met = bant[c];
          const meta = CRITERION_META[c];
          return (
            <ChipToggle
              key={c}
              criterion={c}
              met={met}
              readOnly={readOnly || pending}
              icon={meta.icon}
              hint={meta.hint}
              onToggle={() => toggle(c)}
              formAction={action}
              partyId={partyId}
            />
          );
        })}
      </div>

      {state?.error ? (
        <p className="text-[12.5px] text-down">{state.error}</p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * ChipToggle - one BANT criterion. A tappable card wrapped in its own
 *  <form> so the hidden partyId + criterion inputs are the only ones in
 *  the form (no ambiguity). The button carries the formAction but NO
 *  `name` prop (React 19 overrides name on formAction buttons); the
 *  criterion travels via the hidden <input> sibling.
 * ------------------------------------------------------------------ */
function ChipToggle({
  criterion,
  met,
  readOnly,
  icon,
  hint,
  onToggle,
  formAction,
  partyId,
}: {
  criterion: BantCriterion;
  met: boolean;
  readOnly: boolean;
  icon: React.ReactNode;
  hint: string;
  onToggle: () => void;
  formAction: (formData: FormData) => void;
  partyId: string;
}) {
  return (
    <form action={formAction}>
      {/* Hidden inputs as direct children of the form (NOT inside the
          button) so they are always submitted with this form's data. */}
      <input type="hidden" name="partyId" value={partyId} />
      <input type="hidden" name="criterion" value={criterion} />
      <button
        type="submit"
        disabled={readOnly}
        onClick={onToggle}
        aria-pressed={met}
        className={cn(
          "group/bant flex w-full items-start gap-3 rounded-xl p-3.5 text-left ring-1 transition-all duration-200 ease-soft",
          "min-h-[60px]",
          met
            ? "bg-emerald/[0.07] ring-emerald/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
            : "bg-foreground/[0.02] ring-hairline/60 hover:bg-foreground/[0.04] hover:ring-hairline",
          readOnly && "cursor-default opacity-80 hover:bg-foreground/[0.02]",
        )}
      >
        <span
          className={cn(
            "mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg ring-1 transition-colors duration-200 ease-soft",
            met
              ? "bg-emerald/15 text-emerald ring-emerald/30"
              : "bg-foreground/[0.04] text-muted-foreground ring-hairline/60",
          )}
        >
          {icon}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <span
              className={cn(
                "text-[13px] font-medium",
                met ? "text-foreground" : "text-foreground/85",
              )}
            >
              {BANT_LABELS[criterion]}
            </span>
            {met ? (
              <SealCheck weight="light" className="size-3.5 text-emerald" />
            ) : null}
          </span>
          <span className="text-[11.5px] leading-snug text-muted-foreground">
            {hint}
          </span>
        </span>
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ *
 * BantRing - a small 4-segment progress ring (0–4). Segments fill emerald
 *  as criteria are met; the full ring glows when qualified.
 * ------------------------------------------------------------------ */
function BantRing({
  score,
  qualified,
}: {
  score: number;
  qualified: boolean;
}) {
  const size = 40;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  // 4 segments with small gaps.
  const segLen = circ / 4;
  const gap = 3;
  const fillLen = Math.max(0, segLen - gap);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      aria-hidden
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--hairline, rgba(255,255,255,0.12))"
        strokeWidth={stroke}
        opacity={0.5}
      />
      {Array.from({ length: 4 }).map((_, i) => {
        const active = i < score;
        const start = (i / 4) * circ + gap / 2;
        return (
          <motion.circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={qualified ? "var(--emerald)" : active ? "var(--emerald)" : "transparent"}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${active ? fillLen : 0} ${circ - (active ? fillLen : 0)}`}
            strokeDashoffset={-start}
            style={{ transformOrigin: "center", transform: "rotate(-90deg)" }}
            transition={{ duration: 0.4, ease: EASE }}
          />
        );
      })}
    </svg>
  );
}