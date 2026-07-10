"use client";

import * as React from "react";
import { useActionState } from "react";
import { animate, useInView } from "framer-motion";
import {
  ArrowRight,
  Coins,
  FloppyDisk,
  Plus,
  Sparkle,
  Target,
  TrashSimple,
  TrendUp,
} from "@phosphor-icons/react";

import {
  computeLbo,
  lboDefaults,
  cr as crFmt,
  pctFmt,
  multipleFmt,
  type LboInputs,
  type LboResult,
  type LboTrancheInput,
} from "@/features/modeling/lboModel";
import { createModel, type CreateModelState } from "@/features/modeling/actions";
import { Button } from "@/components/brand/button";
import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/brand/card";
import { Badge } from "@/components/brand/badge";
import { Eyebrow } from "@/components/brand/text";
import { Reveal } from "@/components/brand/reveal";
import { Input } from "@/components/brand/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/brand/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface TrancheForm {
  id: string;
  name: string;
  amountCr: string;
  ratePct: string;
  amortizationPct: string;
}

interface FormState {
  ltmEbitdaCr: string;
  ebitdaGrowthPct: string;
  entryEvEbitda: string;
  exitEvEbitda: string;
  holdPeriodYears: string;
  existingDebtCr: string;
  existingCashCr: string;
  transactionFeePct: string;
  financingFeePct: string;
  managementRolloverCr: string;
  taxRatePct: string;
  capexPctOfEbitdaPct: string;
  nwcPctOfEbitdaChangePct: string;
  daPctOfEbitdaPct: string;
  cashSweepPct: string;
  tranches: TrancheForm[];
}

function defaultsFromModel(): FormState {
  const d = lboDefaults();
  return {
    ltmEbitdaCr: String(d.ltmEbitda / 1e7),
    ebitdaGrowthPct: String(d.ebitdaGrowth * 100),
    entryEvEbitda: String(d.entryEvEbitda),
    exitEvEbitda: String(d.exitEvEbitda),
    holdPeriodYears: String(d.holdPeriodYears),
    existingDebtCr: String(d.existingDebt / 1e7),
    existingCashCr: String(d.existingCash / 1e7),
    transactionFeePct: String(d.transactionFeePct * 100),
    financingFeePct: String(d.financingFeePct * 100),
    managementRolloverCr: String(d.managementRollover / 1e7),
    taxRatePct: String(d.taxRate * 100),
    capexPctOfEbitdaPct: String(d.capexPctOfEbitda * 100),
    nwcPctOfEbitdaChangePct: String(d.nwcPctOfEbitdaChange * 100),
    daPctOfEbitdaPct: String(d.daPctOfEbitda * 100),
    cashSweepPct: String(d.cashSweepPct * 100),
    tranches: d.tranches.map((t, i) => ({
      id: `t${i}-${Math.random().toString(36).slice(2, 8)}`,
      name: t.name,
      amountCr: String(t.amount / 1e7),
      ratePct: String(t.rate * 100),
      amortizationPct: String(t.amortizationPct * 100),
    })),
  };
}

function toLboInputs(f: FormState): LboInputs {
  const cr = (s: string) => (Number(s) || 0) * 1e7;
  const pct = (s: string) => (Number(s) || 0) / 100;
  const num = (s: string) => Number(s) || 0;
  const tranches: LboTrancheInput[] = f.tranches
    .filter((t) => t.name.trim() !== "" && Number(t.amountCr) > 0)
    .map((t) => ({
      name: t.name,
      amount: cr(t.amountCr),
      rate: pct(t.ratePct),
      amortizationPct: pct(t.amortizationPct),
    }));
  return {
    ltmEbitda: cr(f.ltmEbitdaCr),
    entryEvEbitda: num(f.entryEvEbitda),
    exitEvEbitda: num(f.exitEvEbitda),
    holdPeriodYears: num(f.holdPeriodYears),
    ebitdaGrowth: pct(f.ebitdaGrowthPct),
    existingDebt: cr(f.existingDebtCr),
    existingCash: cr(f.existingCashCr),
    transactionFeePct: pct(f.transactionFeePct),
    financingFeePct: pct(f.financingFeePct),
    managementRollover: cr(f.managementRolloverCr),
    taxRate: pct(f.taxRatePct),
    capexPctOfEbitda: pct(f.capexPctOfEbitdaPct),
    nwcPctOfEbitdaChange: pct(f.nwcPctOfEbitdaChangePct),
    daPctOfEbitda: pct(f.daPctOfEbitdaPct),
    cashSweepPct: pct(f.cashSweepPct),
    tranches: tranches.length > 0 ? tranches : [
      { name: "Senior debt", amount: cr(f.ltmEbitdaCr) * 2, rate: 0.10, amortizationPct: 0 },
    ],
  };
}

// ---------------------------------------------------------------------------
// Field primitives
// ---------------------------------------------------------------------------

const fieldClass = cn(
  "bezel-hi h-11 w-full rounded-xl bg-surface px-3.5 text-[14px] text-foreground nums",
  "ring-1 ring-hairline transition-all duration-200 ease-soft",
  "placeholder:text-muted-foreground/55",
  "focus:ring-gold/60 focus:outline-none",
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  "aria-invalid:ring-down/45 aria-invalid:ring-1",
);

const trancheFieldClass = cn(
  "bezel-hi h-9.5 w-full rounded-lg bg-surface px-3 text-[13px] text-foreground nums",
  "ring-1 ring-hairline transition-all duration-200 ease-soft",
  "placeholder:text-muted-foreground/55",
  "focus:ring-gold/60 focus:outline-none",
);

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label
        htmlFor={htmlFor}
        className="text-[12px] font-medium leading-none tracking-[0.1em] text-muted-foreground uppercase"
      >
        {label}
      </Label>
      {children}
      {hint ? (
        <span className="text-[11.5px] leading-tight text-muted-foreground/70">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

function FieldDivider({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="h-px flex-1 bg-hairline" />
      {label ? (
        <span className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60">
          {label}
        </span>
      ) : null}
      <span className="h-px flex-1 bg-hairline" />
    </div>
  );
}

function LiveNumber({
  value,
  format,
  className,
  duration = 0.9,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
  duration?: number;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-5%" });
  const [display, setDisplay] = React.useState(0);
  const playedRef = React.useRef(false);
  React.useEffect(() => {
    if (!inView || playedRef.current) return;
    playedRef.current = true;
    const controls = animate(0, value, {
      duration,
      ease: [0.32, 0.72, 0, 1],
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [inView, value, duration]);
  React.useEffect(() => {
    if (playedRef.current) setDisplay(value);
  }, [value]);
  return (
    <span ref={ref} data-slot="live-number" className={cn("nums tabular-nums font-medium", className)}>
      {format(display)}
    </span>
  );
}

function MetricTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "up" | "down" | "gold" | "emerald";
}) {
  const toneClass =
    tone === "gold" ? "text-gold"
      : tone === "emerald" ? "text-emerald"
      : tone === "up" ? "text-up"
      : tone === "down" ? "text-down"
      : "text-foreground";
  return (
    <div className="bezel-hi relative flex flex-col gap-1.5 rounded-[calc(var(--radius-lg)-0.25rem)] bg-surface-2/50 p-4 ring-1 ring-hairline">
      <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <span className={cn("text-[1.05rem] nums tabular-nums font-medium leading-tight", toneClass)}>{value}</span>
      {hint ? <span className="text-[11px] leading-tight text-muted-foreground/70">{hint}</span> : null}
    </div>
  );
}

// ===========================================================================
// LboCalculator
// ===========================================================================

export function LboCalculator() {
  const [form, setForm] = React.useState<FormState>(defaultsFromModel);
  const [saveState, saveAction, savePending] = useActionState<CreateModelState, FormData>(
    createModel,
    undefined,
  );
  const [saveOpen, setSaveOpen] = React.useState(false);

  const inputs = React.useMemo(() => toLboInputs(form), [form]);
  const { result, error } = React.useMemo(() => {
    try {
      const r = computeLbo(inputs);
      if (!Number.isFinite(r.moic)) {
        return { result: null, error: "Check inputs - the LBO did not compute." };
      }
      return { result: r, error: undefined as string | undefined };
    } catch {
      return {
        result: null,
        error: "Check the inputs - LTM EBITDA, multiples and at least one debt tranche are required.",
      };
    }
  }, [inputs]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updateTranche(id: string, patch: Partial<TrancheForm>) {
    setForm((f) => ({
      ...f,
      tranches: f.tranches.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  }

  function addTranche() {
    setForm((f) => ({
      ...f,
      tranches: [
        ...f.tranches,
        {
          id: `t-${Math.random().toString(36).slice(2, 8)}`,
          name: "New tranche",
          amountCr: "0",
          ratePct: "10",
          amortizationPct: "0",
        },
      ],
    }));
  }

  function removeTranche(id: string) {
    setForm((f) => ({ ...f, tranches: f.tranches.filter((t) => t.id !== id) }));
  }

  const paramsJson = React.useMemo(() => JSON.stringify(inputs), [inputs]);
  const outputsJson = React.useMemo(() => (result ? JSON.stringify(result) : "{}"), [result]);

  const totalDebtCr = form.tranches.reduce((s, t) => s + (Number(t.amountCr) || 0), 0);
  const leverage = totalDebtCr > 0 && Number(form.ltmEbitdaCr) > 0 ? totalDebtCr / Number(form.ltmEbitdaCr) : 0;

  return (
    <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      {/* ---------------- Inputs (left, sticky) ---------------- */}
      <Reveal y={18} className="lg:sticky lg:top-6 h-fit min-w-0">
        <Card shellRadius="2xl">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Deal inputs</CardTitle>
              <Badge variant="neutral" icon={<Coins weight="light" />}>
                {leverage.toFixed(2)}× leverage
              </Badge>
            </div>
            <CardDescription>
              Target, capitalization &amp; exit. Values in ₹ Cr unless noted.
            </CardDescription>
          </CardHeader>
          <CardBody className="flex flex-col gap-5">
            <FieldDivider label="Target" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="LTM EBITDA (₹ Cr)" htmlFor="ltmEbitdaCr">
                <Input id="ltmEbitdaCr" type="number" step="0.5" className={fieldClass} value={form.ltmEbitdaCr} onChange={(e) => update("ltmEbitdaCr", e.target.value)} />
              </Field>
              <Field label="EBITDA growth (%)" htmlFor="ebitdaGrowthPct">
                <Input id="ebitdaGrowthPct" type="number" step="0.5" className={fieldClass} value={form.ebitdaGrowthPct} onChange={(e) => update("ebitdaGrowthPct", e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Existing debt (₹ Cr)" htmlFor="existingDebtCr">
                <Input id="existingDebtCr" type="number" step="1" className={fieldClass} value={form.existingDebtCr} onChange={(e) => update("existingDebtCr", e.target.value)} />
              </Field>
              <Field label="Existing cash (₹ Cr)" htmlFor="existingCashCr">
                <Input id="existingCashCr" type="number" step="0.5" className={fieldClass} value={form.existingCashCr} onChange={(e) => update("existingCashCr", e.target.value)} />
              </Field>
            </div>

            <FieldDivider label="Valuation & hold" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Entry EV/EBITDA (×)" htmlFor="entryEvEbitda">
                <Input id="entryEvEbitda" type="number" step="0.25" className={fieldClass} value={form.entryEvEbitda} onChange={(e) => update("entryEvEbitda", e.target.value)} />
              </Field>
              <Field label="Exit EV/EBITDA (×)" htmlFor="exitEvEbitda">
                <Input id="exitEvEbitda" type="number" step="0.25" className={fieldClass} value={form.exitEvEbitda} onChange={(e) => update("exitEvEbitda", e.target.value)} />
              </Field>
            </div>
            <Field label="Hold period (years)" htmlFor="holdPeriodYears">
              <Input id="holdPeriodYears" type="number" step="1" className={fieldClass} value={form.holdPeriodYears} onChange={(e) => update("holdPeriodYears", e.target.value)} />
            </Field>

            <FieldDivider label="Capitalization - debt tranches" />
            <div className="flex flex-col gap-3">
              {form.tranches.map((t, i) => (
                <div key={t.id} className="flex flex-col gap-2 rounded-[calc(var(--radius-2xl)-0.5rem)] bg-surface-2/40 p-3 ring-1 ring-hairline">
                  <div className="flex items-center gap-2">
                    <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Tranche {i + 1}
                    </span>
                    <span className="ml-auto">
                      <button
                        type="button"
                        onClick={() => removeTranche(t.id)}
                        aria-label={`Remove tranche ${i + 1}`}
                        className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground/70 transition-colors duration-200 ease-soft hover:bg-down/10 hover:text-down"
                      >
                        <TrashSimple weight="light" className="size-4" />
                      </button>
                    </span>
                  </div>
                  <Input
                    type="text"
                    className={trancheFieldClass}
                    value={t.name}
                    onChange={(e) => updateTranche(t.id, { name: e.target.value })}
                    aria-label={`Tranche ${i + 1} name`}
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <Label className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">Amount (Cr)</Label>
                    <Label className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">Rate (%)</Label>
                    <Label className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">Amort (%/yr)</Label>
                    <Input type="number" step="1" className={trancheFieldClass} value={t.amountCr} onChange={(e) => updateTranche(t.id, { amountCr: e.target.value })} aria-label={`Tranche ${i + 1} amount`} />
                    <Input type="number" step="0.05" className={trancheFieldClass} value={t.ratePct} onChange={(e) => updateTranche(t.id, { ratePct: e.target.value })} aria-label={`Tranche ${i + 1} rate`} />
                    <Input type="number" step="0.5" className={trancheFieldClass} value={t.amortizationPct} onChange={(e) => updateTranche(t.id, { amortizationPct: e.target.value })} aria-label={`Tranche ${i + 1} amortization`} />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addTranche}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-hairline py-2.5 text-[12.5px] text-muted-foreground transition-colors duration-200 ease-soft hover:border-emerald/40 hover:text-emerald"
              >
                <Plus weight="light" className="size-4" />
                Add tranche
              </button>
            </div>

            <FieldDivider label="Equity & fees" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Mgmt rollover (₹ Cr)" htmlFor="managementRolloverCr">
                <Input id="managementRolloverCr" type="number" step="1" className={fieldClass} value={form.managementRolloverCr} onChange={(e) => update("managementRolloverCr", e.target.value)} />
              </Field>
              <Field label="Tax rate (%)" htmlFor="taxRatePct" hint="115BAA default">
                <Input id="taxRatePct" type="number" step="0.01" className={fieldClass} value={form.taxRatePct} onChange={(e) => update("taxRatePct", e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Transaction fees (%)" htmlFor="transactionFeePct" hint="of EV">
                <Input id="transactionFeePct" type="number" step="0.05" className={fieldClass} value={form.transactionFeePct} onChange={(e) => update("transactionFeePct", e.target.value)} />
              </Field>
              <Field label="Financing fees (%)" htmlFor="financingFeePct" hint="of new debt">
                <Input id="financingFeePct" type="number" step="0.05" className={fieldClass} value={form.financingFeePct} onChange={(e) => update("financingFeePct", e.target.value)} />
              </Field>
            </div>

            <FieldDivider label="Cash-flow drivers" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Capex (% EBITDA)" htmlFor="capexPctOfEbitdaPct">
                <Input id="capexPctOfEbitdaPct" type="number" step="0.5" className={fieldClass} value={form.capexPctOfEbitdaPct} onChange={(e) => update("capexPctOfEbitdaPct", e.target.value)} />
              </Field>
              <Field label="ΔNWC (% ΔEBITDA)" htmlFor="nwcPctOfEbitdaChangePct">
                <Input id="nwcPctOfEbitdaChangePct" type="number" step="0.5" className={fieldClass} value={form.nwcPctOfEbitdaChangePct} onChange={(e) => update("nwcPctOfEbitdaChangePct", e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="D&A (% EBITDA)" htmlFor="daPctOfEbitdaPct" hint="EBIT tax shield">
                <Input id="daPctOfEbitdaPct" type="number" step="0.5" className={fieldClass} value={form.daPctOfEbitdaPct} onChange={(e) => update("daPctOfEbitdaPct", e.target.value)} />
              </Field>
              <Field label="Cash sweep (%)" htmlFor="cashSweepPct" hint="excess FCF → debt">
                <Input id="cashSweepPct" type="number" step="5" className={fieldClass} value={form.cashSweepPct} onChange={(e) => update("cashSweepPct", e.target.value)} />
              </Field>
            </div>

            <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
              <DialogTrigger
                render={
                  <Button
                    variant="primary-gold"
                    size="md"
                    className="mt-2 w-full"
                    disabled={!result}
                    trailingIcon={<FloppyDisk weight="light" />}
                  />
                }
              >
                Save as model
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Save LBO model</DialogTitle>
                  <DialogDescription>
                    Creates a versioned financial_model record (model_type =
                    lbo) with the current inputs as params and the computed
                    result as outputs. Optionally link to a deal or party.
                  </DialogDescription>
                </DialogHeader>
                <form action={saveAction} className="flex flex-col gap-4">
                  <input type="hidden" name="modelType" value="lbo" />
                  <input type="hidden" name="currencyCode" value="INR" />
                  <input type="hidden" name="params" value={paramsJson} />
                  <input type="hidden" name="outputs" value={outputsJson} />
                  <input type="hidden" name="engineVersion" value="lboModel.v1" />
                  <Field label="Scenario tag (optional)" htmlFor="scenarioTag">
                    <Input id="scenarioTag" name="scenarioTag" className={fieldClass} placeholder="base / bull / bear" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Deal ID (optional UUID)" htmlFor="dealId">
                      <Input id="dealId" name="dealId" className={fieldClass} placeholder="uuid" />
                    </Field>
                    <Field label="Party ID (optional UUID)" htmlFor="partyId">
                      <Input id="partyId" name="partyId" className={fieldClass} placeholder="uuid" />
                    </Field>
                  </div>
                  <Field label="Assumptions note (optional)" htmlFor="assumptionsDoc">
                    <Input id="assumptionsDoc" name="assumptionsDoc" className={fieldClass} placeholder="Source: target CIM; tranche terms per term sheet" />
                  </Field>
                  {saveState?.error ? <p className="text-sm text-down">{saveState.error}</p> : null}
                  <DialogFooter>
                    <Button
                      type="submit"
                      variant="primary-emerald"
                      disabled={savePending}
                      trailingIcon={savePending ? undefined : <ArrowRight weight="light" />}
                    >
                      {savePending ? "Saving…" : "Save model"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardBody>
        </Card>
      </Reveal>

      {/* ---------------- Results (right) ---------------- */}
      <div className="flex flex-col gap-4 md:gap-6">
        {error || !result ? (
          <Reveal y={18}>
            <Card>
              <CardBody className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                <span className="text-muted-foreground/70 [&_svg]:size-8">
                  <Target weight="light" />
                </span>
                <p className="text-lg font-light tracking-[-0.01em] text-foreground/90">
                  {error ?? "Fill the deal to model it."}
                </p>
                <p className="max-w-sm text-[13px] text-muted-foreground">
                  LTM EBITDA, entry &amp; exit multiples, a hold period, and at
                  least one debt tranche are required to compute returns.
                </p>
              </CardBody>
            </Card>
          </Reveal>
        ) : (
          <Results result={result} inputs={inputs} />
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// Results
// ===========================================================================

function Results({ result: r, inputs }: { result: LboResult; inputs: LboInputs }) {
  const su = r.sourcesAndUses;
  const entryMult = inputs.entryEvEbitda;
  const exitMult = inputs.exitEvEbitda;
  return (
    <>
      {/* Headline dual readout */}
      <Reveal y={18}>
        <Card shellRadius="3xl">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <Eyebrow dot>Sponsor returns</Eyebrow>
                <CardTitle>Result</CardTitle>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="gold">MOIC {multipleFmt(r.moic, 2)}</Badge>
                <Badge variant="neutral">Hold {r.periods.length}y</Badge>
                <Badge variant="outline">{r.irr == null ? "IRR n/a" : `IRR ${pctFmt(r.irr, 1)}`}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardBody className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="bezel-hi flex flex-col gap-2 rounded-[calc(var(--radius-2xl)-0.375rem)] bg-surface-2/40 p-5 ring-1 ring-gold/25 md:p-6">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-gold">
                  <Sparkle weight="light" className="size-3.5" />
                  Sponsor IRR
                </span>
                <LiveNumber
                  value={r.irr ?? 0}
                  format={(n) => (r.irr == null ? "n/a" : pctFmt(n, 2))}
                  className="text-[clamp(2.4rem,1.8rem+2vw,3.2rem)] leading-none text-gold"
                />
                <span className="text-[12px] text-muted-foreground">
                  Entry equity {crFmt(su.sponsorEquity)} · exit {crFmt(r.sponsorExitProceeds)}
                </span>
              </div>
              <div className="bezel-hi flex flex-col gap-2 rounded-[calc(var(--radius-2xl)-0.375rem)] bg-surface-2/40 p-5 ring-1 ring-gold/25 md:p-6">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-gold">
                  <TrendUp weight="light" className="size-3.5" />
                  MOIC
                </span>
                <LiveNumber
                  value={r.moic}
                  format={(n) => multipleFmt(n, 2)}
                  className="text-[clamp(2.4rem,1.8rem+2vw,3.2rem)] leading-none text-gold"
                />
                <span className="text-[12px] text-muted-foreground">
                  Sponsor share {(r.sponsorShare * 100).toFixed(1)}% · exit equity {crFmt(r.exitEquity)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <MetricTile label="Entry EV" value={crFmt(r.entryEv)} hint={`${multipleFmt(entryMult, 2)} × EBITDA`} />
              <MetricTile label="Equity cheque" value={crFmt(su.sponsorEquity)} hint="sponsor plug" />
              <MetricTile label="Total new debt" value={crFmt(su.totalNewDebt)} hint={`${(su.totalNewDebt / (r.entryEv || 1)).toFixed(2)}× of EV`} />
              <MetricTile label="Exit EV" value={crFmt(r.exitEv)} hint={`${multipleFmt(exitMult, 2)} × EBITDA`} />
              <MetricTile label="Exit EBITDA" value={crFmt(r.exitEbitda)} hint="grown" />
              <MetricTile label="Net debt @ exit" value={crFmt(r.netDebtAtExit)} tone={r.netDebtAtExit > 0 ? "default" : "up"} />
              <MetricTile label="Debt repaid" value={crFmt(su.totalNewDebt - r.totalDebtAtExit)} tone="up" hint="over hold" />
              <MetricTile label="Cash @ exit" value={crFmt(r.cashAtExit)} />
            </div>
          </CardBody>
        </Card>
      </Reveal>

      {/* Sources & Uses */}
      <Reveal y={18} delay={0.04}>
        <Card>
          <CardHeader>
            <CardTitle>Sources &amp; Uses</CardTitle>
            <CardDescription>Sponsor equity is the plug that balances sources to uses.</CardDescription>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <SuTable title="Uses" rows={su.uses.map((u) => ({ label: u.label, amount: u.amount, note: u.note }))} total={su.totalUses} tone="down" />
              <SuTable title="Sources" rows={su.sources.map((s) => ({ label: s.label, amount: s.amount, note: s.note }))} total={su.totalSources} tone="up" />
            </div>
          </CardBody>
        </Card>
      </Reveal>

      {/* Debt schedule */}
      <Reveal y={18} delay={0.06}>
        <Card>
          <CardHeader>
            <CardTitle>Debt schedule</CardTitle>
            <CardDescription>Annual EBITDA, interest, principal (mandatory + sweep), and the closing debt &amp; cash balances.</CardDescription>
          </CardHeader>
          <CardBody className="flex flex-col gap-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year</TableHead>
                  <TableHead align="right">EBITDA</TableHead>
                  <TableHead align="right">Interest</TableHead>
                  <TableHead align="right">Principal</TableHead>
                  <TableHead align="right" className="hidden sm:table-cell">Net income</TableHead>
                  <TableHead align="right">Total debt</TableHead>
                  <TableHead align="right" className="hidden md:table-cell">Cash</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.periods.map((p) => (
                  <TableRow key={p.year}>
                    <TableCell primary className="nums">{p.year}</TableCell>
                    <TableCell numeric>{crFmt(p.ebitda)}</TableCell>
                    <TableCell numeric className="text-down">{crFmt(p.interest)}</TableCell>
                    <TableCell numeric className="text-up">{crFmt(p.totalPrincipal)}</TableCell>
                    <TableCell numeric className="hidden sm:table-cell">{crFmt(p.netIncome)}</TableCell>
                    <TableCell numeric>{crFmt(p.totalDebt)}</TableCell>
                    <TableCell numeric className="hidden md:table-cell">{crFmt(p.closingCash)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Tranche summary */}
            <div className="flex flex-col gap-3">
              <Eyebrow>Tranche summary</Eyebrow>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {r.trancheSchedules.map((s) => {
                  const repaid = s.originalPrincipal - s.closingBalance;
                  const repaidPct = s.originalPrincipal > 0 ? repaid / s.originalPrincipal : 0;
                  return (
                    <div key={s.name} className="rounded-[calc(var(--radius-2xl)-0.5rem)] bg-surface-2/40 p-3.5 ring-1 ring-hairline">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[12.5px] font-medium text-foreground/90">{s.name}</span>
                        <span className="nums text-[11px] text-muted-foreground">{pctFmt(s.rate, 2)}</span>
                      </div>
                      <div className="mt-2 flex flex-col gap-1 text-[12px]">
                        <div className="flex justify-between"><span className="text-muted-foreground">Original</span><span className="nums tabular-nums">{crFmt(s.originalPrincipal)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Closing</span><span className="nums tabular-nums">{crFmt(s.closingBalance)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Repaid</span><span className="nums tabular-nums text-up">{(repaidPct * 100).toFixed(1)}%</span></div>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
                        <div className="h-full rounded-full bg-emerald" style={{ width: `${Math.min(repaidPct * 100, 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardBody>
        </Card>
      </Reveal>

      {/* Sensitivity heatmap */}
      <Reveal y={18} delay={0.08}>
        <Card>
          <CardHeader>
            <CardTitle>Sensitivity - entry × exit multiple → IRR</CardTitle>
            <CardDescription>Rows: entry EV/EBITDA. Columns: exit EV/EBITDA. Emerald = strong returns, rose = sub-threshold (≤10% IRR).</CardDescription>
          </CardHeader>
          <CardBody>
            <SensitivityHeatmap r={r} entryMult={entryMult} exitMult={exitMult} />
          </CardBody>
        </Card>
      </Reveal>

      {/* Notes */}
      {r.notes.length > 0 ? (
        <Reveal y={18} delay={0.1}>
          <Card>
            <CardBody className="flex flex-col gap-2">
              <Eyebrow>Modelling notes</Eyebrow>
              <ul className="flex flex-col gap-1.5 text-[12.5px] text-muted-foreground">
                {r.notes.map((n, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 size-1 rounded-full bg-gold/70" />
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </Reveal>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Sources/Uses mini-table
// ---------------------------------------------------------------------------

function SuTable({
  title,
  rows,
  total,
  tone,
}: {
  title: string;
  rows: { label: string; amount: number; note?: string }[];
  total: number;
  tone: "up" | "down";
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Eyebrow>{title}</Eyebrow>
        <span className={cn("nums text-[13px] font-medium tabular-nums", tone === "up" ? "text-up" : "text-down")}>
          {crFmt(total)}
        </span>
      </div>
      <div className="flex flex-col">
        {rows.map((row, i) => (
          <div key={row.label + i} className="flex items-baseline justify-between gap-3 border-b border-hairline py-2.5 last:border-b-0">
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] text-foreground/90">{row.label}</span>
              {row.note ? <span className="text-[11px] text-muted-foreground/70">{row.note}</span> : null}
            </div>
            <span className={cn("nums text-[13px] font-medium tabular-nums", row.amount < 0 ? "text-down" : "text-foreground")}>
              {crFmt(row.amount)}
            </span>
          </div>
        ))}
        <div className="mt-1 flex items-baseline justify-between gap-3 pt-2">
          <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Total {title.toLowerCase()}</span>
          <span className={cn("nums text-[14px] font-medium tabular-nums", tone === "up" ? "text-up" : "text-down")}>
            {crFmt(total)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sensitivity heatmap - entry (rows) × exit (cols) → IRR
// ---------------------------------------------------------------------------

function SensitivityHeatmap({ r, entryMult, exitMult }: { r: LboResult; entryMult: number; exitMult: number }) {
  const grid = r.sensitivity;
  // Exit multiples = columns (grid[0].length). Entry multiples = rows.
  const exitSteps = grid[0]?.map((c) => c.exitMultiple) ?? [];
  const entrySteps = grid.map((row) => row[0]?.entryMultiple ?? 0);

  // Normalize IRR across finite cells for the color intensity.
  const finite = grid.flat().map((c) => c.irr).filter((v): v is number => v != null && Number.isFinite(v));
  const min = finite.length ? Math.min(...finite) : 0;
  const max = finite.length ? Math.max(...finite) : 1;
  const span = Math.max(max - min, 1e-9);

  function cellStyle(irr: number | null): string {
    if (irr == null || !Number.isFinite(irr)) return "var(--surface-2)";
    const t = (irr - min) / span;
    if (irr <= 0.10) {
      // Sub-threshold → rose tint scaled by depth.
      return `color-mix(in oklch, var(--down) ${12 + t * 38}%, var(--surface))`;
    }
    return `color-mix(in oklch, var(--emerald) ${12 + t * 40}%, var(--surface))`;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-[11.5px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-surface px-2 py-1.5 text-left text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
              Entry \ Exit
            </th>
            {exitSteps.map((m) => (
              <th key={m} className="px-2 py-1.5 text-center nums tabular-nums text-[11px] text-muted-foreground">
                {multipleFmt(m, 1)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((row, i) => (
            <tr key={i}>
              <td className="sticky left-0 z-10 bg-surface px-2 py-1.5 text-left nums tabular-nums text-[11px] text-muted-foreground">
                {multipleFmt(entrySteps[i], 1)}
              </td>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="rounded-md px-2 py-2 text-center nums tabular-nums font-medium ring-1 ring-hairline/40"
                  style={{ background: cellStyle(cell.irr) }}
                  title={`Entry ${multipleFmt(entrySteps[i], 2)} · Exit ${multipleFmt(cell.exitMultiple, 2)} → IRR ${cell.irr == null ? "n/a" : pctFmt(cell.irr, 1)} · MOIC ${multipleFmt(cell.moic, 2)}`}
                >
                  {cell.irr == null ? "-" : pctFmt(cell.irr, 1)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm" style={{ background: "color-mix(in oklch, var(--down) 35%, var(--surface))" }} />
          ≤ 10% IRR
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm" style={{ background: "color-mix(in oklch, var(--emerald) 35%, var(--surface))" }} />
          &gt; 10% IRR
        </span>
        <span className="ml-auto nums">Base: entry {multipleFmt(entryMult, 2)} · exit {multipleFmt(exitMult, 2)}</span>
      </div>
    </div>
  );
}