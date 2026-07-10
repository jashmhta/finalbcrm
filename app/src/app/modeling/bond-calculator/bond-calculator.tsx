"use client";

import * as React from "react";
import { useActionState } from "react";
import { animate, useInView } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  Calculator,
  ChartLine,
  FloppyDisk,
  Sparkle,
  Target,
  TrendUp,
} from "@phosphor-icons/react";

import {
  computeBondMetrics,
  instrumentDefaults,
  pct,
  inr,
  bp as fmtBp,
  years as fmtYears,
  type BondInputs,
  type BondMetrics,
  type InstrumentType,
  type DayCount,
} from "@/features/modeling/bondPricing";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/brand/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/brand/table";
import { CellEmpty } from "@/components/brand/empty-state";
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

const INSTRUMENTS: InstrumentType[] = [
  "CORP_IG",
  "CORP_HY",
  "NCD",
  "GSEC",
  "SDL",
  "TBILL",
  "CP",
  "SGB",
  "STRUCTURED",
];

const INSTRUMENT_LABEL: Record<InstrumentType, string> = {
  CORP_IG: "Corporate · IG",
  CORP_HY: "Corporate · HY",
  NCD: "Non-Convertible Debenture (NCD)",
  GSEC: "G-Sec",
  SDL: "SDL",
  TBILL: "T-Bill",
  CP: "Commercial Paper",
  SGB: "Sovereign Gold Bond",
  STRUCTURED: "Structured",
};

const DAY_COUNTS: DayCount[] = ["ACT_365", "ACT_360", "thirty_360", "ACT_ACT"];

const FREQUENCIES: { value: 0 | 1 | 2; label: string }[] = [
  { value: 1, label: "Annual" },
  { value: 2, label: "Semi-annual" },
  { value: 0, label: "Zero-coupon" },
];

/** T+1 settlement date as YYYY-MM-DD (Indian default cycle). */
function tPlus1(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface FormState {
  instrumentType: InstrumentType;
  faceValue: string;
  couponRate: string; // percent, e.g. "8.25"
  couponFrequency: 0 | 1 | 2;
  dayCount: DayCount;
  issueDate: string;
  maturityDate: string;
  lastCouponDate: string;
  nextCouponDate: string;
  settlementDate: string;
  solve: "priceFromYtm" | "ytmFromPrice";
  yieldPct: string; // percent
  marketPrice: string;
  priceType: "clean" | "dirty";
  benchmarkYieldPct: string; // percent
}

function defaultsFor(type: InstrumentType): FormState {
  const d = instrumentDefaults(type);
  const settl = tPlus1();
  const iso = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  if (type === "TBILL" || type === "CP") {
    // 91-day T-Bill default
    const mat = new Date();
    mat.setDate(mat.getDate() + 1 + 91);
    return {
      instrumentType: type,
      faceValue: "100",
      couponRate: "0",
      couponFrequency: 0,
      dayCount: d.dayCount,
      issueDate: iso(new Date()),
      maturityDate: iso(mat),
      lastCouponDate: settl,
      nextCouponDate: iso(mat),
      settlementDate: settl,
      solve: "priceFromYtm",
      yieldPct: "6.65",
      marketPrice: "98.50",
      priceType: "dirty",
      benchmarkYieldPct: "",
    };
  }
  // Coupon bond default: 5y residual, annual or semi per instrument.
  const semi = d.couponFrequency === 2;
  return {
    instrumentType: type,
    faceValue: String(d.faceValue),
    couponRate: semi ? "7.18" : "8.25",
    couponFrequency: d.couponFrequency,
    dayCount: d.dayCount,
    issueDate: "2021-06-25",
    maturityDate: semi ? "2034-06-25" : "2030-06-25",
    lastCouponDate: semi ? "2025-12-25" : "2025-06-25",
    nextCouponDate: semi ? "2026-06-25" : "2026-06-25",
    settlementDate: settl,
    solve: "priceFromYtm",
    yieldPct: semi ? "7.05" : "8.40",
    marketPrice: "99.50",
    priceType: d.priceType,
    benchmarkYieldPct: semi ? "7.05" : "7.35",
  };
}

function toBondInputs(f: FormState): BondInputs {
  const coupon = Number(f.couponRate) / 100;
  const yld = Number(f.yieldPct) / 100;
  const bench = f.benchmarkYieldPct.trim()
    ? Number(f.benchmarkYieldPct) / 100
    : undefined;
  const inputs: BondInputs = {
    instrumentType: f.instrumentType,
    faceValue: Number(f.faceValue),
    couponRate: coupon,
    couponFrequency: f.couponFrequency,
    dayCount: f.dayCount,
    issueDate: f.issueDate || undefined,
    maturityDate: f.maturityDate,
    lastCouponDate: f.lastCouponDate,
    nextCouponDate: f.nextCouponDate,
    settlementDate: f.settlementDate,
    benchmarkYield: bench,
  };
  if (f.solve === "priceFromYtm") {
    inputs.yield = yld;
  } else {
    inputs.marketPrice = Number(f.marketPrice);
    inputs.priceType = f.priceType;
  }
  return inputs;
}

// ---------------------------------------------------------------------------
// Field primitive - aligned label + double-bezel input/select. Generous
// vertical rhythm so the left panel reads as a machined instrument, not a
// cramped form. Label is sized to the micro-eyebrow scale and baseline-aligned
// across every field via a fixed-height label row.
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
        className="text-[13px] font-medium leading-none tracking-[0.1em] text-muted-foreground uppercase"
      >
        {label}
      </Label>
      {children}
      {hint ? (
        <span className="text-[12px] leading-tight text-muted-foreground/70">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/** Hairline section divider inside the input panel - replaces shadcn Separator. */
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

// ---------------------------------------------------------------------------
// LiveNumber - one-shot count-up on first view, then snaps to live value.
// Avoids re-animating on every keystroke while the calculator recomputes.
// ---------------------------------------------------------------------------

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

  // One-shot 0 → initial-value count-up the first time the readout enters view.
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

  // After the intro has played, reflect the live value directly (no re-tween).
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

// ---------------------------------------------------------------------------
// MetricTile - a single analytic readout (duration / convexity / DV01 / …).
// Mono tabular-nums, hairline ring, inset highlight - a mini double-bezel.
// ---------------------------------------------------------------------------

function MetricTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "up" | "down" | "gold";
}) {
  const toneClass =
    tone === "gold"
      ? "text-gold"
      : tone === "up"
        ? "text-up"
        : tone === "down"
          ? "text-down"
          : "text-foreground";
  return (
    <div className="bezel-hi relative flex flex-col gap-1.5 rounded-[calc(var(--radius-lg)-0.25rem)] bg-surface-2/50 p-4 ring-1 ring-hairline transition-colors duration-200 ease-soft hover:ring-hairline/70">
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

// ---------------------------------------------------------------------------
// Price-yield curve - the "instrument" chart.
//   • Hairline grid (single faint horizontal lines, no vertical noise)
//   • Soft gold area fill with a 3-stop gradient (rich at the curve, fading
//     to transparent at the floor)
//   • Mono axis ticks at a readable 12px, baselined
//   • A MOVABLE reference point: a slider scrubs a yield (±300 bp around the
//     solved YTM) and the dot + crosshair track along the curve, with a live
//     clean/dirty readout - the trader's "what if yield moves X bp" question
//     answered inline. Defaults to the current YTM (0 bp).
//   • Double-bezel tooltip pill with mono numbers.
// ---------------------------------------------------------------------------

/** Linear interpolation of clean/dirty price at an arbitrary yield from the
 *  ±300 bp grid (25 bp steps). Good enough for the scrubber readout. */
function priceAtYield(
  curve: { yield: number; cleanPrice: number; dirtyPrice: number }[],
  y: number,
): { clean: number; dirty: number } {
  if (curve.length === 0) return { clean: NaN, dirty: NaN };
  if (y <= curve[0].yield) return { clean: curve[0].cleanPrice, dirty: curve[0].dirtyPrice };
  const last = curve[curve.length - 1];
  if (y >= last.yield) return { clean: last.cleanPrice, dirty: last.dirtyPrice };
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1];
    const b = curve[i];
    if (y >= a.yield && y <= b.yield) {
      const t = (y - a.yield) / (b.yield - a.yield);
      return {
        clean: a.cleanPrice + (b.cleanPrice - a.cleanPrice) * t,
        dirty: a.dirtyPrice + (b.dirtyPrice - a.dirtyPrice) * t,
      };
    }
  }
  return { clean: NaN, dirty: NaN };
}

function PriceYieldCurve({ m }: { m: BondMetrics }) {
  const data = React.useMemo(
    () =>
      m.priceYieldCurve.map((p) => ({
        yield: Number((p.yield * 100).toFixed(3)),
        clean: p.cleanPrice,
        dirty: p.dirtyPrice,
      })),
    [m],
  );
  const ytmPct = Number((m.ytm * 100).toFixed(3));

  // Movable reference point - yield offset in bp around the solved YTM.
  // 0 bp = current YTM (the dot sits exactly at the solved price).
  const [refBp, setRefBp] = React.useState(0);
  const refYield = m.ytm + refBp / 10_000;
  const refYieldPct = Number((refYield * 100).toFixed(3));
  const refPrice = React.useMemo(
    () => priceAtYield(m.priceYieldCurve, refYield),
    [m.priceYieldCurve, refYield],
  );
  const priceDelta = refPrice.clean - m.cleanPrice;

  return (
    <div className="flex flex-col gap-4">
      <div className="h-[340px] w-full text-muted-foreground md:h-[380px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 16, bottom: 6, left: 4 }}
          >
            <defs>
              <linearGradient id="pyFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.28} />
                <stop offset="55%" stopColor="var(--gold)" stopOpacity={0.1} />
                <stop offset="100%" stopColor="var(--gold)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="pyStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--gold-deep)" />
                <stop offset="50%" stopColor="var(--gold)" />
                <stop offset="100%" stopColor="var(--gold-deep)" />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="currentColor"
              strokeOpacity={0.1}
              strokeDasharray="1 6"
              vertical={false}
            />
            <XAxis
              dataKey="yield"
              type="number"
              domain={["dataMin", "dataMax"]}
              tick={{ fill: "currentColor", fontSize: 12, fontFamily: "var(--font-mono)" }}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              tickFormatter={(v: number) => `${v.toFixed(2)}%`}
              stroke="currentColor"
              strokeOpacity={0.18}
            />
            <YAxis
              tick={{ fill: "currentColor", fontSize: 12, fontFamily: "var(--font-mono)" }}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              width={64}
              domain={["dataMin - 0.5", "dataMax + 0.5"]}
              tickFormatter={(v: number) => v.toFixed(2)}
              stroke="currentColor"
              strokeOpacity={0.18}
            />
            <Tooltip
              cursor={{ stroke: "currentColor", strokeOpacity: 0.22, strokeDasharray: "3 3" }}
              content={<CurveTooltip />}
            />
            <Area
              type="monotone"
              dataKey="clean"
              stroke="url(#pyStroke)"
              strokeWidth={1.75}
              fill="url(#pyFill)"
              isAnimationActive
              animationDuration={950}
              animationEasing="ease-out"
              dot={false}
              activeDot={{
                r: 3.5,
                fill: "var(--gold)",
                stroke: "var(--surface)",
                strokeWidth: 2,
              }}
            />
            {/* Solved YTM - dashed emerald line, static. */}
            <ReferenceLine
              x={ytmPct}
              stroke="var(--emerald)"
              strokeOpacity={0.5}
              strokeDasharray="3 4"
              label={{
                value: "YTM",
                fill: "var(--emerald)",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                position: "insideTopLeft",
              }}
            />
            {/* Movable reference point - the user-driven dot. */}
            {Number.isFinite(refYieldPct) && Number.isFinite(refPrice.clean) ? (
              <>
                <ReferenceLine
                  x={refYieldPct}
                  stroke="var(--gold)"
                  strokeOpacity={0.6}
                  strokeDasharray="2 3"
                />
                <ReferenceDot
                  x={refYieldPct}
                  y={refPrice.clean}
                  r={5}
                  fill="var(--gold)"
                  stroke="var(--surface)"
                  strokeWidth={2.5}
                />
              </>
            ) : null}
            {/* The solved point itself - emerald, smaller, sits beneath the
                gold dot when the slider is at 0 bp. */}
            <ReferenceDot
              x={ytmPct}
              y={m.cleanPrice}
              r={3.5}
              fill="var(--emerald)"
              stroke="var(--surface)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Movable reference point control - a premium "what-if" scrubber. */}
      <div className="flex flex-col gap-3 rounded-[calc(var(--radius-lg)-0.25rem)] bg-surface-2/40 p-4 ring-1 ring-hairline">
        <div className="flex items-baseline justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <Target weight="light" className="size-3.5 text-gold" />
            Reference yield
          </span>
          <span className="inline-flex items-baseline gap-2">
            <span className="nums tabular-nums text-[14px] font-medium text-foreground">
              {pct(refYield, 4)}
            </span>
            <span
              className={cn(
                "nums tabular-nums text-[12px]",
                refBp === 0 ? "text-muted-foreground" : priceDelta >= 0 ? "text-up" : "text-down",
              )}
            >
              {refBp >= 0 ? "+" : ""}
              {refBp} bp
            </span>
          </span>
        </div>
        <input
          type="range"
          min={-300}
          max={300}
          step={25}
          value={refBp}
          onChange={(e) => setRefBp(Number(e.target.value))}
          aria-label="Reference yield offset in basis points"
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-foreground/10 accent-gold md:h-1.5"
        />
        <div className="grid grid-cols-3 gap-2 text-[12px]">
          <Readout label="Clean" value={Number.isFinite(refPrice.clean) ? inr(refPrice.clean, 4) : "-"} />
          <Readout label="Dirty" value={Number.isFinite(refPrice.dirty) ? inr(refPrice.dirty, 4) : "-"} />
          <Readout
            label="ΔP"
            value={`${priceDelta >= 0 ? "+" : ""}${priceDelta.toFixed(4)}`}
            tone={priceDelta >= 0 ? "up" : "down"}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[11.5px] text-muted-foreground/80">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-gold" />
          Clean price curve
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald" />
          Solved YTM {pct(m.ytm, 4)}
        </span>
        <span className="hidden sm:inline nums">ΔP/P ≈ -Dmod·Δy + ½·Cvx·Δy²</span>
      </div>
    </div>
  );
}

function Readout({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "up" | "down";
}) {
  const toneClass = tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-foreground";
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
        {label}
      </span>
      <span className={cn("nums tabular-nums text-[13px] font-medium", toneClass)}>
        {value}
      </span>
    </div>
  );
}

function CurveTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { yield: number; clean: number; dirty: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl bg-surface/90 p-3 ring-1 ring-hairline shadow-floating backdrop-blur-md">
      <div className="flex flex-col gap-1.5 text-[12px]">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Yield {p.yield.toFixed(3)}%
        </span>
        <span className="nums tabular-nums text-foreground">
          Clean {inr(p.clean, 4)}
        </span>
        <span className="nums tabular-nums text-muted-foreground">
          Dirty {inr(p.dirty, 4)}
        </span>
      </div>
    </div>
  );
}

// ===========================================================================
// BondCalculator
// ===========================================================================

export function BondCalculator() {
  const [form, setForm] = React.useState<FormState>(() => defaultsFor("CORP_IG"));
  const [saveState, saveAction, savePending] = useActionState<
    CreateModelState,
    FormData
  >(createModel, undefined);
  const [saveOpen, setSaveOpen] = React.useState(false);

  // Recompute on every input change. Wrap in try/catch - bad inputs (e.g.
  // empty date) produce NaN/Infinity which we surface as an error card.
  const { metrics, error } = React.useMemo(() => {
    try {
      const inputs = toBondInputs(form);
      const m = computeBondMetrics(inputs);
      if (!Number.isFinite(m.cleanPrice)) {
        return {
          metrics: null,
          error:
            "Check inputs - price did not converge (missing dates or invalid yield).",
        };
      }
      return { metrics: m, error: undefined as string | undefined };
    } catch {
      // Don't leak the raw JS exception text (e.g. "Invalid time value") into
      // the UI - surface a calm, actionable message instead. The catch fires
      // only on malformed inputs (empty/invalid dates, non-numeric yield), so a
      // static hint is always correct + friendlier than a stack-trace string.
      return {
        metrics: null,
        error: "Check the inputs - maturity, settlement and a valid yield or price are required to price this instrument.",
      };
    }
  }, [form]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function changeInstrument(type: InstrumentType) {
    setForm(defaultsFor(type));
  }

  const conv = instrumentDefaults(form.instrumentType);
  const isDiscount = form.instrumentType === "TBILL" || form.instrumentType === "CP";

  // Save payload: params (the inputs) + outputs (the metrics) as JSON strings.
  const paramsJson = React.useMemo(() => JSON.stringify(toBondInputs(form)), [form]);
  const outputsJson = React.useMemo(
    () => (metrics ? JSON.stringify(metrics) : "{}"),
    [metrics],
  );

  return (
    <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
      {/* ---------------- Inputs (left, sticky) ---------------- */}
      <Reveal y={18} className="lg:sticky lg:top-6 h-fit min-w-0">
        <Card shellRadius="2xl">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Instrument</CardTitle>
              <Badge variant="neutral" icon={<Calculator weight="light" />}>
                {conv.conventionLabel}
              </Badge>
            </div>
            <CardDescription>
              Indian conventions by default. Every result surfaces its
              convention chips - what you see is what priced.
            </CardDescription>
          </CardHeader>
          <CardBody className="flex flex-col gap-5">
            <Field label="Instrument type" htmlFor="instrumentType">
              <Select
                value={form.instrumentType}
                onValueChange={(v) => changeInstrument(v as InstrumentType)}
              >
                <SelectTrigger id="instrumentType" className={fieldClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INSTRUMENTS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {INSTRUMENT_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Face value (₹)" htmlFor="faceValue">
                <Input
                  id="faceValue"
                  type="number"
                  step="0.01"
                  className={fieldClass}
                  value={form.faceValue}
                  onChange={(e) => update("faceValue", e.target.value)}
                />
              </Field>
              <Field label="Coupon (%)" htmlFor="couponRate">
                <Input
                  id="couponRate"
                  type="number"
                  step="0.01"
                  className={fieldClass}
                  value={form.couponRate}
                  disabled={isDiscount}
                  onChange={(e) => update("couponRate", e.target.value)}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Frequency" htmlFor="frequency">
                <Select
                  value={String(form.couponFrequency)}
                  onValueChange={(v) =>
                    update("couponFrequency", Number(v) as 0 | 1 | 2)
                  }
                >
                  <SelectTrigger id="frequency" className={fieldClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((f) => (
                      <SelectItem key={f.value} value={String(f.value)}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Day count" htmlFor="dayCount">
                <Select
                  value={form.dayCount}
                  onValueChange={(v) => update("dayCount", v as DayCount)}
                >
                  <SelectTrigger id="dayCount" className={fieldClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAY_COUNTS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d.replace("_", "/")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <FieldDivider label="Dates" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Maturity" htmlFor="maturityDate">
                <Input
                  id="maturityDate"
                  type="date"
                  className={fieldClass}
                  value={form.maturityDate}
                  onChange={(e) => update("maturityDate", e.target.value)}
                />
              </Field>
              <Field label="Settlement" htmlFor="settlementDate" hint="T+1 default">
                <Input
                  id="settlementDate"
                  type="date"
                  className={fieldClass}
                  value={form.settlementDate}
                  onChange={(e) => update("settlementDate", e.target.value)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Last coupon" htmlFor="lastCouponDate">
                <Input
                  id="lastCouponDate"
                  type="date"
                  className={fieldClass}
                  value={form.lastCouponDate}
                  disabled={isDiscount}
                  onChange={(e) => update("lastCouponDate", e.target.value)}
                />
              </Field>
              <Field label="Next coupon" htmlFor="nextCouponDate">
                <Input
                  id="nextCouponDate"
                  type="date"
                  className={fieldClass}
                  value={form.nextCouponDate}
                  disabled={isDiscount}
                  onChange={(e) => update("nextCouponDate", e.target.value)}
                />
              </Field>
            </div>

            <FieldDivider label="Pricing" />
            <Field label="Solve direction">
              <Select
                value={form.solve}
                onValueChange={(v) => update("solve", v as FormState["solve"])}
              >
                <SelectTrigger className={fieldClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="priceFromYtm">Price from YTM</SelectItem>
                  <SelectItem value="ytmFromPrice">YTM from price</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            {form.solve === "priceFromYtm" ? (
              <Field label="YTM (%)" htmlFor="yieldPct">
                <Input
                  id="yieldPct"
                  type="number"
                  step="0.01"
                  className={fieldClass}
                  value={form.yieldPct}
                  onChange={(e) => update("yieldPct", e.target.value)}
                />
              </Field>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Market price" htmlFor="marketPrice">
                  <Input
                    id="marketPrice"
                    type="number"
                    step="0.0001"
                    className={fieldClass}
                    value={form.marketPrice}
                    onChange={(e) => update("marketPrice", e.target.value)}
                  />
                </Field>
                <Field label="Quote type" htmlFor="priceType">
                  <Select
                    value={form.priceType}
                    onValueChange={(v) =>
                      update("priceType", v as "clean" | "dirty")
                    }
                  >
                    <SelectTrigger id="priceType" className={fieldClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clean">Clean</SelectItem>
                      <SelectItem value="dirty">Dirty</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            )}

            <Field
              label="Benchmark G-Sec YTM (%)"
              htmlFor="benchmarkYieldPct"
              hint="For G-spread - optional"
            >
              <Input
                id="benchmarkYieldPct"
                type="number"
                step="0.01"
                placeholder="optional"
                className={fieldClass}
                value={form.benchmarkYieldPct}
                onChange={(e) => update("benchmarkYieldPct", e.target.value)}
              />
            </Field>

            <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
              <DialogTrigger
                render={
                  <Button
                    variant="primary-gold"
                    size="md"
                    className="mt-2 w-full"
                    disabled={!metrics}
                    trailingIcon={<FloppyDisk weight="light" />}
                  />
                }
              >
                Save as model
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Save bond pricing model</DialogTitle>
                  <DialogDescription>
                    Creates a versioned financial_model record (model_type =
                    bond_pricing) with the current inputs as params and the
                    computed metrics as outputs. Optionally link to a deal or
                    party.
                  </DialogDescription>
                </DialogHeader>
                <form action={saveAction} className="flex flex-col gap-4">
                  <input type="hidden" name="modelType" value="bond_pricing" />
                  <input type="hidden" name="currencyCode" value="INR" />
                  <input type="hidden" name="params" value={paramsJson} />
                  <input type="hidden" name="outputs" value={outputsJson} />
                  <input type="hidden" name="engineVersion" value="bondPricing.v1" />
                  <Field label="Scenario tag (optional)" htmlFor="scenarioTag">
                    <Input
                      id="scenarioTag"
                      name="scenarioTag"
                      className={fieldClass}
                      placeholder="base / bull / stress-200bp"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Deal ID (optional UUID)" htmlFor="dealId">
                      <Input
                        id="dealId"
                        name="dealId"
                        className={fieldClass}
                        placeholder="uuid"
                      />
                    </Field>
                    <Field label="Party ID (optional UUID)" htmlFor="partyId">
                      <Input
                        id="partyId"
                        name="partyId"
                        className={fieldClass}
                        placeholder="uuid"
                      />
                    </Field>
                  </div>
                  <Field label="Assumptions note (optional)" htmlFor="assumptionsDoc">
                    <Input
                      id="assumptionsDoc"
                      name="assumptionsDoc"
                      className={fieldClass}
                      placeholder="Source: offer document ISIN INE…; YTM from NDS-OM"
                    />
                  </Field>
                  {saveState?.error ? (
                    <p className="text-sm text-down">{saveState.error}</p>
                  ) : null}
                  <DialogFooter>
                    <Button
                      type="submit"
                      variant="primary-emerald"
                      disabled={savePending}
                      trailingIcon={
                        savePending ? undefined : <ArrowRight weight="light" />
                      }
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
        {error || !metrics ? (
          <Reveal y={18}>
            <Card>
              <CardBody className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                <span className="text-muted-foreground/70 [&_svg]:size-8">
                  <Target weight="light" />
                </span>
                <p className="text-lg font-light tracking-[-0.01em] text-foreground/90">
                  {error ?? "Fill the instrument to price it."}
                </p>
                <p className="max-w-sm text-[13px] text-muted-foreground">
                  Maturity, settlement and either YTM or market price are
                  required. Conventions are inferred from the instrument type.
                </p>
              </CardBody>
            </Card>
          </Reveal>
        ) : (
          <Results metrics={metrics} />
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// Results - the double-bezel "instrument" readout
// ===========================================================================

function Results({ metrics: m }: { metrics: BondMetrics }) {
  return (
    <>
      {/* Headline + curve */}
      <Reveal y={18}>
        <Card shellRadius="3xl">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <Eyebrow dot>Live pricing</Eyebrow>
                <CardTitle>Result</CardTitle>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="neutral">{m.dayCount.replace("_", "/")}</Badge>
                <Badge variant="neutral">
                  {m.couponFrequency === 0
                    ? "Zero-coupon"
                    : m.couponFrequency === 1
                      ? "Annual"
                      : "Semi-annual"}
                </Badge>
                <Badge variant="neutral">Settlement {m.settlementDate}</Badge>
                {m.instrumentType === "TBILL" ? (
                  <Badge variant="gold">Discount</Badge>
                ) : null}
                <Badge variant="outline">
                  {m.remainingCoupons} CF{m.remainingCoupons === 1 ? "" : "s"} · w{" "}
                  {m.w.toFixed(4)}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardBody className="flex flex-col gap-6">
            {/* Headline readout - gold mono Clean price + emerald YTM.
                Two equal-weight tiles, baseline-aligned labels, large mono
                numerals on a shared clamp scale so they read as one instrument. */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="bezel-hi flex flex-col gap-2 rounded-[calc(var(--radius-2xl)-0.375rem)] bg-surface-2/40 p-5 ring-1 ring-gold/25 md:p-6">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-gold">
                  <Sparkle weight="light" className="size-3.5" />
                  Clean price
                </span>
                <LiveNumber
                  value={m.cleanPrice}
                  format={(n) => inr(n, 4)}
                  className="text-[clamp(2.4rem,1.8rem+2vw,3.2rem)] leading-none text-gold"
                />
                <span className="text-[12px] text-muted-foreground">
                  Dirty {inr(m.dirtyPrice, 4)} · accrued {inr(m.accruedInterest, 4)}{" "}
                  ({m.daysAccrued}d)
                </span>
              </div>
              <div className="bezel-hi flex flex-col gap-2 rounded-[calc(var(--radius-2xl)-0.375rem)] bg-surface-2/40 p-5 ring-1 ring-gold/25 md:p-6">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-gold">
                  <TrendUp weight="light" className="size-3.5" />
                  Yield to maturity
                </span>
                <LiveNumber
                  value={m.ytm}
                  format={(n) => pct(n, 4)}
                  className="text-[clamp(2.4rem,1.8rem+2vw,3.2rem)] leading-none text-gold"
                />
                <span className="text-[12px] text-muted-foreground">
                  Current yield {pct(m.currentYield, 4)} · periodic r{" "}
                  {pct(m.periodicYield, 4)}
                </span>
              </div>
            </div>

            {/* Price-yield curve */}
            <div className="flex flex-col gap-4 rounded-[calc(var(--radius-2xl)-0.375rem)] bg-surface-2/30 p-4 ring-1 ring-hairline md:p-5">
              <div className="flex items-center justify-between gap-3">
                <Eyebrow>
                  <ChartLine weight="light" className="size-3.5" />
                  Price-yield curve · ±300 bp
                </Eyebrow>
                <span className="text-[11px] text-muted-foreground/70">
                  drag the reference yield
                </span>
              </div>
              <PriceYieldCurve m={m} />
            </div>

            {/* Analytics tiles */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <MetricTile
                label="Macaulay dur."
                value={fmtYears(m.macaulayDuration)}
                hint="years"
              />
              <MetricTile
                label="Modified dur."
                value={fmtYears(m.modifiedDuration)}
                hint="years · ∂P/∂y"
              />
              <MetricTile
                label="DV01"
                value={m.dv01.toFixed(4)}
                hint="₹/bp per ₹100 face"
              />
              <MetricTile
                label="Convexity"
                value={m.convexity.toFixed(3)}
                hint="years²"
              />
              <MetricTile
                label="G-spread"
                value={fmtBp(m.gSpread)}
                hint="vs matched G-Sec"
                tone={m.gSpread == null ? "default" : m.gSpread >= 0 ? "up" : "down"}
              />
              <MetricTile
                label="Current yield"
                value={pct(m.currentYield, 4)}
              />
              <MetricTile
                label="Accrued interest"
                value={inr(m.accruedInterest, 4)}
                hint={`${m.daysAccrued}/${m.daysInCouponPeriod}d`}
              />
              <MetricTile
                label="Dirty price"
                value={inr(m.dirtyPrice, 4)}
                hint="Σ PV of cash flows"
              />
              {m.tbill ? (
                <>
                  <MetricTile
                    label="Discount yield"
                    value={pct(m.tbill.discountYield, 4)}
                  />
                  <MetricTile
                    label="Days to maturity"
                    value={String(m.tbill.daysToMaturity)}
                  />
                </>
              ) : null}
            </div>
          </CardBody>
        </Card>
      </Reveal>

      {/* Detail tables */}
      <Reveal y={18} delay={0.05}>
        <Card>
          <CardHeader>
            <CardTitle>Detail schedules</CardTitle>
            <CardDescription>
              Full cash-flow waterfall and the ±300 bp price-yield grid the
              curve is drawn from.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <Tabs defaultValue="cashflows">
              <TabsList>
                <TabsTrigger value="cashflows">Cash-flow schedule</TabsTrigger>
                <TabsTrigger value="curve">Price-yield grid</TabsTrigger>
              </TabsList>
              <TabsContent value="cashflows" className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead align="right">Periods k</TableHead>
                      <TableHead align="right">Years t</TableHead>
                      <TableHead align="right">Coupon</TableHead>
                      <TableHead align="right">Principal</TableHead>
                      <TableHead align="right">Cash flow</TableHead>
                      <TableHead align="right">DF</TableHead>
                      <TableHead align="right">PV</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {m.cashFlows.map((cf, i) => (
                      <TableRow key={`${cf.date}-${i}`}>
                        <TableCell className="nums">
                          {cf.date}
                        </TableCell>
                        <TableCell numeric>
                          <span className="nums tabular-nums text-foreground/85">
                            {cf.periodsFromSettlement.toFixed(4)}
                          </span>
                        </TableCell>
                        <TableCell numeric>
                          <span className="nums tabular-nums text-foreground/85">
                            {cf.yearsFromSettlement.toFixed(4)}
                          </span>
                        </TableCell>
                        <TableCell numeric>
                          {cf.coupon ? (
                            <span className="nums tabular-nums text-foreground/85">
                              {inr(cf.coupon, 2)}
                            </span>
                          ) : (
                            <CellEmpty label="No coupon" />
                          )}
                        </TableCell>
                        <TableCell numeric>
                          {cf.principal ? (
                            <span className="nums tabular-nums text-foreground/85">
                              {inr(cf.principal, 2)}
                            </span>
                          ) : (
                            <CellEmpty label="No principal" />
                          )}
                        </TableCell>
                        <TableCell numeric primary>
                          <span className="nums tabular-nums">
                            {inr(cf.cashFlow, 2)}
                          </span>
                        </TableCell>
                        <TableCell numeric>
                          <span className="nums tabular-nums text-muted-foreground">
                            {cf.discountFactor.toFixed(6)}
                          </span>
                        </TableCell>
                        <TableCell numeric>
                          <span className="nums tabular-nums text-foreground/85">
                            {inr(cf.presentValue, 4)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="hover:bg-transparent hover:before:opacity-0 border-t border-hairline/70">
                      <TableCell colSpan={6} primary>
                        Dirty price (Σ PV)
                      </TableCell>
                      <TableCell />
                      <TableCell numeric primary className="font-semibold">
                        <span className="nums tabular-nums text-foreground">
                          {inr(m.dirtyPrice, 4)}
                        </span>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TabsContent>
              <TabsContent value="curve" className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Yield</TableHead>
                      <TableHead align="right">Δ bp</TableHead>
                      <TableHead align="right">Clean price</TableHead>
                      <TableHead align="right">Dirty price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {m.priceYieldCurve.map((p) => {
                      const deltaBp = (p.yield - m.ytm) * 10_000;
                      const isCurrent = Math.abs(deltaBp) < 1;
                      return (
                        <TableRow
                          key={p.yield}
                          selected={isCurrent}
                        >
                          <TableCell numeric>
                            <span className="nums tabular-nums text-foreground">
                              {pct(p.yield, 4)}
                            </span>
                          </TableCell>
                          <TableCell
                            numeric
                            className={deltaBp >= 0 ? "text-up" : "text-down"}
                          >
                            <span className="nums tabular-nums">
                              {deltaBp >= 0 ? "+" : ""}
                              {deltaBp.toFixed(0)}
                            </span>
                          </TableCell>
                          <TableCell numeric>
                            <span className="nums tabular-nums text-foreground/90">
                              {inr(p.cleanPrice, 4)}
                            </span>
                          </TableCell>
                          <TableCell numeric>
                            <span className="nums tabular-nums text-foreground/90">
                              {inr(p.dirtyPrice, 4)}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </CardBody>
        </Card>
      </Reveal>
    </>
  );
}