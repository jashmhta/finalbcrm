"use client";

import * as React from "react";
import { useActionState } from "react";
import { animate, useInView } from "framer-motion";
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  Calculator,
  FloppyDisk,
  Handshake,
  Sparkle,
  Target,
  TrendUp,
} from "@phosphor-icons/react";

import {
  computeMaModel,
  maDefaults,
  cr as crFmt,
  inrAbs,
  pctFmt,
  epsFmt,
  type MaInputs,
  type MaResult,
} from "@/features/modeling/maModel";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/brand/select";
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
// Form state - inputs are strings; Cr-scaled fields are ×1e7 on submit, %
// fields ÷100, shares in millions ×1e6.
// ---------------------------------------------------------------------------

interface FormState {
  // Acquirer
  acqRevenueCr: string;
  acqEbitdaMarginPct: string;
  acqNetIncomeCr: string;
  acqSharesMn: string;
  acqSharePrice: string;
  acqExistingDebtCr: string;
  acqCashCr: string;
  acqTaxRatePct: string;
  // Target
  tgtRevenueCr: string;
  tgtEbitdaCr: string;
  tgtNetIncomeCr: string;
  tgtFreeCashFlowCr: string;
  tgtExistingDebtCr: string;
  tgtCashCr: string;
  tgtNetAssetsCr: string;
  // Deal - consideration & fees
  equityPurchasePriceCr: string;
  refinanceTargetDebt: "yes" | "no";
  targetCashAcquired: "yes" | "no";
  advisoryFeePct: string;
  financingFeePct: string;
  integrationCostCr: string;
  // Deal - financing
  newDebtCr: string;
  newDebtCostPct: string;
  stockConsiderationCr: string;
  // Deal - synergies
  runRateSynergiesCr: string;
  synergyPhaseInYears: string;
  synergyRealizationPct: string;
  // Deal - returns
  holdPeriodYears: string;
  exitEvEbitda: string;
}

function defaultsFromModel(): FormState {
  const d = maDefaults();
  return {
    acqRevenueCr: String(d.acquirer.revenue / 1e7),
    acqEbitdaMarginPct: String(d.acquirer.ebitdaMargin * 100),
    acqNetIncomeCr: String(d.acquirer.netIncome / 1e7),
    acqSharesMn: String(d.acquirer.sharesOutstanding / 1e6),
    acqSharePrice: String(d.acquirer.sharePrice),
    acqExistingDebtCr: String(d.acquirer.existingDebt / 1e7),
    acqCashCr: String(d.acquirer.cash / 1e7),
    acqTaxRatePct: String(d.acquirer.taxRate * 100),
    tgtRevenueCr: String(d.target.revenue / 1e7),
    tgtEbitdaCr: String(d.target.ebitda / 1e7),
    tgtNetIncomeCr: String(d.target.netIncome / 1e7),
    tgtFreeCashFlowCr: String(d.target.freeCashFlow / 1e7),
    tgtExistingDebtCr: String(d.target.existingDebt / 1e7),
    tgtCashCr: String(d.target.cash / 1e7),
    tgtNetAssetsCr: String(d.target.identifiableNetAssetsFairValue / 1e7),
    equityPurchasePriceCr: String(d.deal.equityPurchasePrice / 1e7),
    refinanceTargetDebt: d.deal.refinanceTargetDebt ? "yes" : "no",
    targetCashAcquired: d.deal.targetCashAcquired ? "yes" : "no",
    advisoryFeePct: String(d.deal.advisoryFeePct * 100),
    financingFeePct: String(d.deal.financingFeePct * 100),
    integrationCostCr: String(d.deal.integrationCost / 1e7),
    newDebtCr: String(d.deal.newDebt / 1e7),
    newDebtCostPct: String(d.deal.newDebtCost * 100),
    stockConsiderationCr: String(d.deal.stockConsideration / 1e7),
    runRateSynergiesCr: String(d.deal.runRateSynergies / 1e7),
    synergyPhaseInYears: String(d.deal.synergyPhaseInYears),
    synergyRealizationPct: String(d.deal.synergyRealizationPct * 100),
    holdPeriodYears: String(d.deal.holdPeriodYears),
    exitEvEbitda: String(d.deal.exitEvEbitda),
  };
}

function toMaInputs(f: FormState): MaInputs {
  const cr = (s: string) => (Number(s) || 0) * 1e7;
  const pct = (s: string) => (Number(s) || 0) / 100;
  const num = (s: string) => Number(s) || 0;
  return {
    acquirer: {
      revenue: cr(f.acqRevenueCr),
      ebitdaMargin: pct(f.acqEbitdaMarginPct),
      netIncome: cr(f.acqNetIncomeCr),
      sharesOutstanding: num(f.acqSharesMn) * 1e6,
      sharePrice: num(f.acqSharePrice),
      existingDebt: cr(f.acqExistingDebtCr),
      cash: cr(f.acqCashCr),
      taxRate: pct(f.acqTaxRatePct),
    },
    target: {
      revenue: cr(f.tgtRevenueCr),
      ebitda: cr(f.tgtEbitdaCr),
      netIncome: cr(f.tgtNetIncomeCr),
      freeCashFlow: cr(f.tgtFreeCashFlowCr),
      existingDebt: cr(f.tgtExistingDebtCr),
      cash: cr(f.tgtCashCr),
      identifiableNetAssetsFairValue: cr(f.tgtNetAssetsCr),
    },
    deal: {
      equityPurchasePrice: cr(f.equityPurchasePriceCr),
      refinanceTargetDebt: f.refinanceTargetDebt === "yes",
      targetCashAcquired: f.targetCashAcquired === "yes",
      advisoryFeePct: pct(f.advisoryFeePct),
      financingFeePct: pct(f.financingFeePct),
      integrationCost: cr(f.integrationCostCr),
      newDebt: cr(f.newDebtCr),
      newDebtCost: pct(f.newDebtCostPct),
      stockConsideration: cr(f.stockConsiderationCr),
      runRateSynergies: cr(f.runRateSynergiesCr),
      synergyPhaseInYears: num(f.synergyPhaseInYears),
      synergyRealizationPct: pct(f.synergyRealizationPct),
      holdPeriodYears: num(f.holdPeriodYears),
      exitEvEbitda: num(f.exitEvEbitda),
    },
  };
}

// ---------------------------------------------------------------------------
// Field primitives (mirroring the bond calculator's machined-instrument feel)
// ---------------------------------------------------------------------------

const fieldClass = cn(
  "bezel-hi h-11 w-full rounded-xl bg-surface px-3.5 text-[14px] text-foreground nums",
  "ring-1 ring-hairline transition-all duration-200 ease-soft",
  "placeholder:text-muted-foreground/55",
  "focus:ring-gold/60 focus:outline-none",
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  "aria-invalid:ring-down/45 aria-invalid:ring-1",
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
    <span
      ref={ref}
      data-slot="live-number"
      className={cn("nums tabular-nums font-medium", className)}
    >
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
    tone === "gold"
      ? "text-gold"
      : tone === "emerald"
        ? "text-emerald"
        : tone === "up"
          ? "text-up"
          : tone === "down"
            ? "text-down"
            : "text-foreground";
  return (
    <div className="bezel-hi relative flex flex-col gap-1.5 rounded-[calc(var(--radius-lg)-0.25rem)] bg-surface-2/50 p-4 ring-1 ring-hairline">
      <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <span className={cn("text-[1.05rem] nums tabular-nums font-medium leading-tight", toneClass)}>
        {value}
      </span>
      {hint ? (
        <span className="text-[11px] leading-tight text-muted-foreground/70">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

// ===========================================================================
// MaCalculator
// ===========================================================================

export function MaCalculator() {
  const [form, setForm] = React.useState<FormState>(defaultsFromModel);
  const [saveState, saveAction, savePending] = useActionState<
    CreateModelState,
    FormData
  >(createModel, undefined);
  const [saveOpen, setSaveOpen] = React.useState(false);

  const inputs = React.useMemo(() => toMaInputs(form), [form]);
  const { result, error } = React.useMemo(() => {
    try {
      const r = computeMaModel(inputs);
      if (!Number.isFinite(r.accretionDilution.accretionPct)) {
        return { result: null, error: "Check inputs - accretion did not compute." };
      }
      return { result: r, error: undefined as string | undefined };
    } catch {
      return {
        result: null,
        error: "Check the inputs - share count, price and purchase price are required.",
      };
    }
  }, [inputs]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const paramsJson = React.useMemo(() => JSON.stringify(inputs), [inputs]);
  const outputsJson = React.useMemo(
    () => (result ? JSON.stringify(result) : "{}"),
    [result],
  );

  const consideration =
    Number(form.stockConsiderationCr) <= 0
      ? "Cash deal"
      : Number(form.stockConsiderationCr) >= Number(form.equityPurchasePriceCr)
        ? "Stock deal"
        : "Mixed (cash + stock)";

  return (
    <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
      {/* ---------------- Inputs (left, sticky) ---------------- */}
      <Reveal y={18} className="lg:sticky lg:top-6 h-fit min-w-0">
        <Card shellRadius="2xl">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Deal inputs</CardTitle>
              <Badge variant="neutral" icon={<Handshake weight="light" />}>
                {consideration}
              </Badge>
            </div>
            <CardDescription>
              Acquirer + target financials, deal structure &amp; financing.
              Values in ₹ Cr unless noted.
            </CardDescription>
          </CardHeader>
          <CardBody className="flex flex-col gap-5">
            <FieldDivider label="Acquirer" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Revenue (₹ Cr)" htmlFor="acqRevenueCr">
                <Input id="acqRevenueCr" type="number" step="1" className={fieldClass} value={form.acqRevenueCr} onChange={(e) => update("acqRevenueCr", e.target.value)} />
              </Field>
              <Field label="EBITDA margin (%)" htmlFor="acqEbitdaMarginPct">
                <Input id="acqEbitdaMarginPct" type="number" step="0.1" className={fieldClass} value={form.acqEbitdaMarginPct} onChange={(e) => update("acqEbitdaMarginPct", e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Net income (₹ Cr)" htmlFor="acqNetIncomeCr">
                <Input id="acqNetIncomeCr" type="number" step="1" className={fieldClass} value={form.acqNetIncomeCr} onChange={(e) => update("acqNetIncomeCr", e.target.value)} />
              </Field>
              <Field label="Shares (mn)" htmlFor="acqSharesMn">
                <Input id="acqSharesMn" type="number" step="0.1" className={fieldClass} value={form.acqSharesMn} onChange={(e) => update("acqSharesMn", e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Share price (₹)" htmlFor="acqSharePrice">
                <Input id="acqSharePrice" type="number" step="0.5" className={fieldClass} value={form.acqSharePrice} onChange={(e) => update("acqSharePrice", e.target.value)} />
              </Field>
              <Field label="Tax rate (%)" htmlFor="acqTaxRatePct" hint="115BAA default">
                <Input id="acqTaxRatePct" type="number" step="0.01" className={fieldClass} value={form.acqTaxRatePct} onChange={(e) => update("acqTaxRatePct", e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Existing debt (₹ Cr)" htmlFor="acqExistingDebtCr">
                <Input id="acqExistingDebtCr" type="number" step="1" className={fieldClass} value={form.acqExistingDebtCr} onChange={(e) => update("acqExistingDebtCr", e.target.value)} />
              </Field>
              <Field label="Cash (₹ Cr)" htmlFor="acqCashCr" hint="Funding-plug cap">
                <Input id="acqCashCr" type="number" step="1" className={fieldClass} value={form.acqCashCr} onChange={(e) => update("acqCashCr", e.target.value)} />
              </Field>
            </div>

            <FieldDivider label="Target" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Revenue (₹ Cr)" htmlFor="tgtRevenueCr">
                <Input id="tgtRevenueCr" type="number" step="1" className={fieldClass} value={form.tgtRevenueCr} onChange={(e) => update("tgtRevenueCr", e.target.value)} />
              </Field>
              <Field label="EBITDA (₹ Cr)" htmlFor="tgtEbitdaCr">
                <Input id="tgtEbitdaCr" type="number" step="0.5" className={fieldClass} value={form.tgtEbitdaCr} onChange={(e) => update("tgtEbitdaCr", e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Net income (₹ Cr)" htmlFor="tgtNetIncomeCr">
                <Input id="tgtNetIncomeCr" type="number" step="0.5" className={fieldClass} value={form.tgtNetIncomeCr} onChange={(e) => update("tgtNetIncomeCr", e.target.value)} />
              </Field>
              <Field label="Free cash flow (₹ Cr)" htmlFor="tgtFreeCashFlowCr" hint="FCFE - annual">
                <Input id="tgtFreeCashFlowCr" type="number" step="0.5" className={fieldClass} value={form.tgtFreeCashFlowCr} onChange={(e) => update("tgtFreeCashFlowCr", e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Existing debt (₹ Cr)" htmlFor="tgtExistingDebtCr">
                <Input id="tgtExistingDebtCr" type="number" step="1" className={fieldClass} value={form.tgtExistingDebtCr} onChange={(e) => update("tgtExistingDebtCr", e.target.value)} />
              </Field>
              <Field label="Cash (₹ Cr)" htmlFor="tgtCashCr">
                <Input id="tgtCashCr" type="number" step="0.5" className={fieldClass} value={form.tgtCashCr} onChange={(e) => update("tgtCashCr", e.target.value)} />
              </Field>
            </div>
            <Field label="Identifiable net assets @ FV (₹ Cr)" htmlFor="tgtNetAssetsCr" hint="FV assets − FV liabilities, excl. goodwill">
              <Input id="tgtNetAssetsCr" type="number" step="1" className={fieldClass} value={form.tgtNetAssetsCr} onChange={(e) => update("tgtNetAssetsCr", e.target.value)} />
            </Field>

            <FieldDivider label="Consideration & fees" />
            <Field label="Equity purchase price (₹ Cr)" htmlFor="equityPurchasePriceCr">
              <Input id="equityPurchasePriceCr" type="number" step="1" className={fieldClass} value={form.equityPurchasePriceCr} onChange={(e) => update("equityPurchasePriceCr", e.target.value)} />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Refinance target debt" htmlFor="refinanceTargetDebt">
                <Select value={form.refinanceTargetDebt} onValueChange={(v) => update("refinanceTargetDebt", v as "yes" | "no")}>
                  <SelectTrigger id="refinanceTargetDebt" className={fieldClass}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes - retire at close</SelectItem>
                    <SelectItem value="no">No - assume</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Capture target cash" htmlFor="targetCashAcquired">
                <Select value={form.targetCashAcquired} onValueChange={(v) => update("targetCashAcquired", v as "yes" | "no")}>
                  <SelectTrigger id="targetCashAcquired" className={fieldClass}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes - as a source</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Advisory fees (%)" htmlFor="advisoryFeePct" hint="of consideration">
                <Input id="advisoryFeePct" type="number" step="0.05" className={fieldClass} value={form.advisoryFeePct} onChange={(e) => update("advisoryFeePct", e.target.value)} />
              </Field>
              <Field label="Financing fees (%)" htmlFor="financingFeePct" hint="of new debt">
                <Input id="financingFeePct" type="number" step="0.05" className={fieldClass} value={form.financingFeePct} onChange={(e) => update("financingFeePct", e.target.value)} />
              </Field>
            </div>
            <Field label="Integration cost (₹ Cr)" htmlFor="integrationCostCr" hint="One-time, year 0">
              <Input id="integrationCostCr" type="number" step="1" className={fieldClass} value={form.integrationCostCr} onChange={(e) => update("integrationCostCr", e.target.value)} />
            </Field>

            <FieldDivider label="Financing" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="New debt (₹ Cr)" htmlFor="newDebtCr">
                <Input id="newDebtCr" type="number" step="1" className={fieldClass} value={form.newDebtCr} onChange={(e) => update("newDebtCr", e.target.value)} />
              </Field>
              <Field label="Cost of new debt (%)" htmlFor="newDebtCostPct">
                <Input id="newDebtCostPct" type="number" step="0.05" className={fieldClass} value={form.newDebtCostPct} onChange={(e) => update("newDebtCostPct", e.target.value)} />
              </Field>
            </div>
            <Field label="Stock consideration (₹ Cr)" htmlFor="stockConsiderationCr" hint="0 = cash deal; full price = stock deal">
              <Input id="stockConsiderationCr" type="number" step="1" className={fieldClass} value={form.stockConsiderationCr} onChange={(e) => update("stockConsiderationCr", e.target.value)} />
            </Field>

            <FieldDivider label="Synergies" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Run-rate synergies (₹ Cr)" htmlFor="runRateSynergiesCr">
                <Input id="runRateSynergiesCr" type="number" step="0.5" className={fieldClass} value={form.runRateSynergiesCr} onChange={(e) => update("runRateSynergiesCr", e.target.value)} />
              </Field>
              <Field label="Phase-in (years)" htmlFor="synergyPhaseInYears">
                <Input id="synergyPhaseInYears" type="number" step="1" className={fieldClass} value={form.synergyPhaseInYears} onChange={(e) => update("synergyPhaseInYears", e.target.value)} />
              </Field>
            </div>
            <Field label="Realization (%)" htmlFor="synergyRealizationPct" hint="Banker's conservatism haircut">
              <Input id="synergyRealizationPct" type="number" step="5" className={fieldClass} value={form.synergyRealizationPct} onChange={(e) => update("synergyRealizationPct", e.target.value)} />
            </Field>

            <FieldDivider label="Returns" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Hold period (years)" htmlFor="holdPeriodYears">
                <Input id="holdPeriodYears" type="number" step="1" className={fieldClass} value={form.holdPeriodYears} onChange={(e) => update("holdPeriodYears", e.target.value)} />
              </Field>
              <Field label="Exit EV/EBITDA (×)" htmlFor="exitEvEbitda">
                <Input id="exitEvEbitda" type="number" step="0.25" className={fieldClass} value={form.exitEvEbitda} onChange={(e) => update("exitEvEbitda", e.target.value)} />
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
                  <DialogTitle>Save M&amp;A model</DialogTitle>
                  <DialogDescription>
                    Creates a versioned financial_model record (model_type =
                    m_and_a) with the current inputs as params and the
                    computed result as outputs. Optionally link to a deal or
                    party.
                  </DialogDescription>
                </DialogHeader>
                <form action={saveAction} className="flex flex-col gap-4">
                  <input type="hidden" name="modelType" value="m_and_a" />
                  <input type="hidden" name="currencyCode" value="INR" />
                  <input type="hidden" name="params" value={paramsJson} />
                  <input type="hidden" name="outputs" value={outputsJson} />
                  <input type="hidden" name="engineVersion" value="maModel.v1" />
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
                    <Input id="assumptionsDoc" name="assumptionsDoc" className={fieldClass} placeholder="Source: target CIM; synergies per mgmt plan" />
                  </Field>
                  {saveState?.error ? (
                    <p className="text-sm text-down">{saveState.error}</p>
                  ) : null}
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
                  Acquirer shares &amp; price, the purchase price, and target
                  financials are required to compute accretion &amp; IRR.
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

function Results({ result: r, inputs }: { result: MaResult; inputs: MaInputs }) {
  const acc = r.accretionDilution;
  const irr = r.dealIrr;
  const su = r.sourcesAndUses;
  const gw = r.goodwill;
  const exitMult = irr.exitEbitda > 0 ? irr.exitEv / irr.exitEbitda : 0;

  return (
    <>
      {/* Headline dual readout */}
      <Reveal y={18}>
        <Card shellRadius="3xl">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <Eyebrow dot>Run-rate M&amp;A result</Eyebrow>
                <CardTitle>Result</CardTitle>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant={acc.accretive ? "gold" : "neutral"}>
                  {acc.accretive ? "Accretive" : "Dilutive"}
                </Badge>
                <Badge variant="neutral">Implied EV {crFmt(r.impliedEv)}</Badge>
                <Badge variant="outline">{irr.irr == null ? "IRR n/a" : `IRR ${pctFmt(irr.irr, 1)}`}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardBody className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="bezel-hi flex flex-col gap-2 rounded-[calc(var(--radius-2xl)-0.375rem)] bg-surface-2/40 p-5 ring-1 ring-gold/25 md:p-6">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-gold">
                  <Sparkle weight="light" className="size-3.5" />
                  EPS accretion
                </span>
                <LiveNumber
                  value={acc.accretionPct}
                  format={(n) => pctFmt(n, 2)}
                  className={cn(
                    "text-[clamp(2.4rem,1.8rem+2vw,3.2rem)] leading-none",
                    acc.accretive ? "text-gold" : "text-down",
                  )}
                />
                <span className="text-[12px] text-muted-foreground">
                  Pro-forma EPS {epsFmt(acc.proFormaEps)} · standalone {epsFmt(acc.standaloneEps)}
                </span>
              </div>
              <div className="bezel-hi flex flex-col gap-2 rounded-[calc(var(--radius-2xl)-0.375rem)] bg-surface-2/40 p-5 ring-1 ring-gold/25 md:p-6">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-gold">
                  <TrendUp weight="light" className="size-3.5" />
                  Acquirer deal IRR
                </span>
                <LiveNumber
                  value={irr.irr ?? 0}
                  format={(n) => (irr.irr == null ? "n/a" : pctFmt(n, 2))}
                  className="text-[clamp(2.4rem,1.8rem+2vw,3.2rem)] leading-none text-gold"
                />
                <span className="text-[12px] text-muted-foreground">
                  Deployed {crFmt(irr.totalDeployed)} · exit equity {crFmt(irr.exitEquity)}
                </span>
              </div>
            </div>

            {/* Key metrics row */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <MetricTile label="Goodwill" value={crFmt(gw.goodwill)} tone={gw.bargainPurchase ? "down" : "gold"} hint={gw.bargainPurchase ? "Bargain purchase" : "IFRS 3"} />
              <MetricTile label="Pro-forma EPS" value={epsFmt(acc.proFormaEps)} />
              <MetricTile label="New shares (mn)" value={(acc.newSharesIssued / 1e6).toFixed(2)} hint={acc.newSharesIssued > 0 ? "Stock issuance" : "Cash deal"} />
              <MetricTile label="After-tax interest" value={crFmt(acc.afterTaxInterest)} hint="on new debt" tone="down" />
              <MetricTile label="After-tax synergies" value={crFmt(acc.afterTaxSynergies)} hint="run-rate × realization" tone="up" />
              <MetricTile label="Exit EBITDA" value={crFmt(irr.exitEbitda)} hint={`${exitMult.toFixed(2)}× → EV ${crFmt(irr.exitEv)}`} />
              <MetricTile label="Combined m-cap" value={crFmt(r.combinedMarketCap)} hint="at acquirer price" />
              <MetricTile label="Funding" value={su.fundingShortfall ? "Shortfall" : "Balanced"} tone={su.fundingShortfall ? "down" : "up"} hint={su.fundingShortfall ? "raise more" : "plug ≤ cash"} />
            </div>
          </CardBody>
        </Card>
      </Reveal>

      {/* Sources & Uses */}
      <Reveal y={18} delay={0.04}>
        <Card>
          <CardHeader>
            <CardTitle>Sources &amp; Uses</CardTitle>
            <CardDescription>Total capital deployed at close. Sources balance to uses via the acquirer cash plug.</CardDescription>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <SuTable title="Uses" rows={su.uses.map((u) => ({ label: u.label, amount: u.amount, note: u.note }))} total={su.totalUses} tone="down" />
              <SuTable title="Sources" rows={su.sources.map((s) => ({ label: s.label, amount: s.amount, note: s.note }))} total={su.totalSources} tone="up" />
            </div>
            {su.fundingShortfall ? (
              <p className="mt-4 text-[12.5px] text-down">
                Funding shortfall - the acquirer cash plug ({crFmt(su.acquirerCashUsed)}) exceeds cash on hand. Raise more debt/equity or cut the price.
              </p>
            ) : null}
          </CardBody>
        </Card>
      </Reveal>

      {/* Goodwill + Accretion breakdown */}
      <Reveal y={18} delay={0.06}>
        <Card>
          <CardHeader>
            <CardTitle>Goodwill &amp; accretion bridge</CardTitle>
            <CardDescription>IFRS 3 / Ind AS 103 purchase price allocation and the pro-forma EPS build.</CardDescription>
          </CardHeader>
          <CardBody className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-[calc(var(--radius-2xl)-0.375rem)] bg-surface-2/40 p-4 ring-1 ring-hairline">
                <Eyebrow>Purchase price allocation</Eyebrow>
                <div className="mt-3 flex flex-col gap-2 text-[13px]">
                  <BridgeRow label="Consideration transferred" value={crFmt(gw.considerationTransferred)} />
                  <BridgeRow label="Non-controlling interest" value={crFmt(gw.nonControllingInterest)} muted />
                  <BridgeRow label="Identifiable net assets @ FV" value={`(${crFmt(gw.identifiableNetAssetsFairValue)})`} muted />
                  <div className="my-1 h-px bg-hairline" />
                  <BridgeRow label="Goodwill" value={crFmt(gw.goodwill)} bold tone={gw.bargainPurchase ? "down" : "gold"} />
                </div>
              </div>
              <div className="rounded-[calc(var(--radius-2xl)-0.375rem)] bg-surface-2/40 p-4 ring-1 ring-hairline">
                <Eyebrow>Pro-forma EPS build</Eyebrow>
                <div className="mt-3 flex flex-col gap-2 text-[13px]">
                  <BridgeRow label="Acquirer NI" value={crFmt(inputs.acquirer.netIncome)} />
                  <BridgeRow label="(+) Target NI" value={crFmt(inputs.target.netIncome)} />
                  <BridgeRow label="(−) After-tax interest" value={`(${crFmt(acc.afterTaxInterest)})`} muted />
                  <BridgeRow label="(+) After-tax synergies" value={crFmt(acc.afterTaxSynergies)} />
                  <div className="my-1 h-px bg-hairline" />
                  <BridgeRow label="Pro-forma NI" value={crFmt(acc.proFormaNetIncome)} bold />
                  <BridgeRow label="÷ Pro-forma shares (mn)" value={(acc.proFormaShares / 1e6).toFixed(2)} muted />
                  <div className="my-1 h-px bg-hairline" />
                  <BridgeRow label="Pro-forma EPS" value={epsFmt(acc.proFormaEps)} bold tone={acc.accretive ? "gold" : "down"} />
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </Reveal>

      {/* Deal IRR cash flows chart + table */}
      <Reveal y={18} delay={0.08}>
        <Card>
          <CardHeader>
            <CardTitle>Acquirer deal IRR - cash flows</CardTitle>
            <CardDescription>Year-0 outflow (total deployed), target FCFE + after-tax synergies through the hold, exit equity at year n.</CardDescription>
          </CardHeader>
          <CardBody className="flex flex-col gap-5">
            <DealIrrChart r={r} />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year</TableHead>
                  <TableHead align="right">Target FCF</TableHead>
                  <TableHead align="right">Synergy cash</TableHead>
                  <TableHead align="right">Exit equity</TableHead>
                  <TableHead align="right">Net cash flow</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell primary className="nums">0</TableCell>
                  <TableCell numeric className="text-muted-foreground">-</TableCell>
                  <TableCell numeric className="text-muted-foreground">-</TableCell>
                  <TableCell numeric className="text-muted-foreground">-</TableCell>
                  <TableCell numeric className="text-down">{crFmt(-irr.totalDeployed)}</TableCell>
                </TableRow>
                {irr.cashFlows.map((row) => (
                  <TableRow key={row.year}>
                    <TableCell primary className="nums">{row.year}</TableCell>
                    <TableCell numeric>{crFmt(row.fcf)}</TableCell>
                    <TableCell numeric className="text-up">{crFmt(row.synergyCash)}</TableCell>
                    <TableCell numeric className="text-gold">{row.exitEquity > 0 ? crFmt(row.exitEquity) : "-"}</TableCell>
                    <TableCell numeric className={row.total >= 0 ? "text-up" : "text-down"}>{crFmt(row.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
          <div
            key={row.label + i}
            className="flex items-baseline justify-between gap-3 border-b border-hairline py-2.5 last:border-b-0"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] text-foreground/90">{row.label}</span>
              {row.note ? (
                <span className="text-[11px] text-muted-foreground/70">{row.note}</span>
              ) : null}
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

function BridgeRow({
  label,
  value,
  muted,
  bold,
  tone = "default",
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
  tone?: "default" | "up" | "down" | "gold";
}) {
  const toneClass =
    tone === "gold" ? "text-gold" : tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-foreground";
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={cn("text-muted-foreground", muted ? "text-muted-foreground/70" : "", bold ? "font-medium text-foreground" : "")}>
        {label}
      </span>
      <span className={cn("nums tabular-nums font-medium", bold ? toneClass : muted ? "text-muted-foreground" : "text-foreground")}>
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Deal IRR cash-flow chart
// ---------------------------------------------------------------------------

function DealIrrChart({ r }: { r: MaResult }) {
  const data = React.useMemo(() => {
    const rows = [
      { year: "Y0", total: -r.dealIrr.totalDeployed, kind: "out" as const },
      ...r.dealIrr.cashFlows.map((c) => ({
        year: `Y${c.year}`,
        total: c.total,
        kind: c.exitEquity > 0 ? ("exit" as const) : ("in" as const),
      })),
    ];
    return rows;
  }, [r]);

  return (
    <div className="h-[280px] w-full text-muted-foreground">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 16, bottom: 6, left: 4 }}>
          <CartesianGrid stroke="currentColor" strokeOpacity={0.1} strokeDasharray="1 6" vertical={false} />
          <XAxis
            dataKey="year"
            tick={{ fill: "currentColor", fontSize: 12, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={false}
            dy={8}
          />
          <YAxis
            tick={{ fill: "currentColor", fontSize: 12, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={false}
            width={68}
            tickFormatter={(v: number) => crFmt(v)}
            stroke="currentColor"
            strokeOpacity={0.18}
          />
          <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.3} />
          <Tooltip
            cursor={{ fill: "currentColor", fillOpacity: 0.05 }}
            content={<IrrTooltip />}
          />
          <Bar dataKey="total" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={900}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.kind === "out" ? "var(--down)" : d.kind === "exit" ? "var(--gold)" : "var(--emerald)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function IrrTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { year: string; total: number; kind: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl bg-surface/90 p-3 ring-1 ring-hairline shadow-floating backdrop-blur-md">
      <div className="flex flex-col gap-1 text-[12px]">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {p.year} · {p.kind === "out" ? "outflow" : p.kind === "exit" ? "exit + FCF" : "FCF + synergies"}
        </span>
        <span className="nums tabular-nums text-foreground">{crFmt(p.total)}</span>
      </div>
    </div>
  );
}