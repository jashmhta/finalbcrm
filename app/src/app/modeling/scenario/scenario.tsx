"use client";

import * as React from "react";
import { useActionState } from "react";
import { animate, useInView } from "framer-motion";
import {
  ArrowRight,
  Crosshair,
  FloppyDisk,
  Sparkle,
  TrendDown,
  TrendUp,
} from "@phosphor-icons/react";

import {
  SCENARIO_MODEL_LIST,
  getScenarioModel,
  computeScenarios,
  computeSensitivity,
  defaultDriverState,
  formatDriver,
  formatOutcome,
  type ScenarioModelType,
  type DriverStateMap,
  type ScenarioCases,
  type ScenarioOutcome,
  type SensitivityGrid,
} from "@/features/modeling/scenarioAnalysis";
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
// Form state - per-driver base + downside/upside %. Stored as strings.
// ---------------------------------------------------------------------------

interface DriverForm {
  base: string;
  downPct: string;
  upPct: string;
}
type DriverFormMap = Record<string, DriverForm>;

function initDriverForm(type: ScenarioModelType): DriverFormMap {
  const def = getScenarioModel(type);
  const state = defaultDriverState(def);
  const out: DriverFormMap = {};
  for (const d of def.drivers) {
    const s = state[d.key];
    const down = s.base !== 0 ? ((s.base - s.min) / Math.abs(s.base)) * 100 : 0;
    const up = s.base !== 0 ? ((s.max - s.base) / Math.abs(s.base)) * 100 : 0;
    out[d.key] = {
      base: String(Number(s.base.toFixed(4))),
      downPct: String(Math.round(down)),
      upPct: String(Math.round(up)),
    };
  }
  return out;
}

function toDriverState(form: DriverFormMap, type: ScenarioModelType): DriverStateMap {
  const def = getScenarioModel(type);
  const out: DriverStateMap = {};
  for (const d of def.drivers) {
    const f = form[d.key] ?? { base: String(d.base), downPct: "20", upPct: "20" };
    const base = Number(f.base) || 0;
    const down = (Number(f.downPct) || 0) / 100;
    const up = (Number(f.upPct) || 0) / 100;
    let min = base * (1 - down);
    let max = base * (1 + up);
    if (min > max) [min, max] = [max, min];
    out[d.key] = { base, min, max };
  }
  return out;
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
);

const smallFieldClass = cn(
  "bezel-hi h-9.5 w-full rounded-lg bg-surface px-2.5 text-[13px] text-foreground nums",
  "ring-1 ring-hairline transition-all duration-200 ease-soft",
  "placeholder:text-muted-foreground/55",
  "focus:ring-gold/60 focus:outline-none",
);

function LiveNumber({
  value,
  format,
  className,
  duration = 0.8,
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

// ===========================================================================
// ScenarioDesk
// ===========================================================================

export function ScenarioDesk() {
  const [type, setType] = React.useState<ScenarioModelType>("lbo");
  const [form, setForm] = React.useState<DriverFormMap>(() => initDriverForm("lbo"));
  const [xKey, setXKey] = React.useState<string>(() => getScenarioModel("lbo").defaultSensitivityX);
  const [yKey, setYKey] = React.useState<string>(() => getScenarioModel("lbo").defaultSensitivityY);
  const [steps, setSteps] = React.useState<number>(7);

  const [saveState, saveAction, savePending] = useActionState<CreateModelState, FormData>(
    createModel,
    undefined,
  );
  const [saveOpen, setSaveOpen] = React.useState(false);

  const def = getScenarioModel(type);

  function changeModel(t: ScenarioModelType) {
    setType(t);
    setForm(initDriverForm(t));
    const nd = getScenarioModel(t);
    setXKey(nd.defaultSensitivityX);
    setYKey(nd.defaultSensitivityY);
  }

  function updateDriver(key: string, patch: Partial<DriverForm>) {
    setForm((f) => ({ ...f, [key]: { ...f[key], ...patch } }));
  }

  const state = React.useMemo(() => toDriverState(form, type), [form, type]);
  const cases = React.useMemo<ScenarioCases>(() => computeScenarios(def, state), [def, state]);
  const grid = React.useMemo<SensitivityGrid>(
    () => computeSensitivity(def, xKey, yKey, steps, state),
    [def, xKey, yKey, steps, state],
  );

  const paramsJson = React.useMemo(
    () => JSON.stringify({ scenarioModelType: type, driverState: state, sensitivity: { xKey, yKey, steps } }),
    [type, state, xKey, yKey, steps],
  );
  const outputsJson = React.useMemo(
    () => JSON.stringify({ best: cases.best, base: cases.base, worst: cases.worst, direction: cases.direction }),
    [cases],
  );

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {/* Model selector */}
      <Reveal y={14}>
        <Card>
          <CardBody className="flex flex-col gap-3 py-4">
            <Eyebrow>Select a model</Eyebrow>
            <div className="flex flex-wrap gap-2">
              {SCENARIO_MODEL_LIST.map((m) => (
                <button
                  key={m.type}
                  type="button"
                  onClick={() => changeModel(m.type)}
                  className={cn(
                    "rounded-full px-4 py-2 text-[13px] font-medium transition-all duration-300 ease-soft",
                    m.type === type
                      ? "bg-gold text-on-gold shadow-pill"
                      : "ring-1 ring-hairline bg-surface/40 text-foreground/80 hover:bg-surface hover:ring-hairline/70",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="text-[12.5px] text-muted-foreground">{def.description}</p>
          </CardBody>
        </Card>
      </Reveal>

      <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* ---------------- Drivers (left) ---------------- */}
        <Reveal y={18} className="lg:sticky lg:top-6 h-fit min-w-0">
          <Card shellRadius="2xl">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Drivers</CardTitle>
                <Badge variant="neutral" icon={<Crosshair weight="light" />}>
                  {def.drivers.length} flexed
                </Badge>
              </div>
              <CardDescription>
                Set each driver&apos;s base, downside &amp; upside. Corners
                drive the best / worst cases.
              </CardDescription>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              {def.drivers.map((d) => {
                const f = form[d.key];
                const s = state[d.key];
                return (
                  <div key={d.key} className="flex flex-col gap-2 rounded-[calc(var(--radius-2xl)-0.5rem)] bg-surface-2/40 p-3.5 ring-1 ring-hairline">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[12.5px] font-medium text-foreground/90">{d.label}</span>
                      <span className="nums text-[10.5px] text-muted-foreground/70">
                        {formatDriver(s.min, d.unit, 2)} – {formatDriver(s.max, d.unit, 2)}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex flex-col gap-1">
                        <Label className="text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground/70">Base</Label>
                        <Input type="number" step={d.step} className={smallFieldClass} value={f.base} onChange={(e) => updateDriver(d.key, { base: e.target.value })} aria-label={`${d.label} base`} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground/70">Down %</Label>
                        <Input type="number" step="1" className={smallFieldClass} value={f.downPct} onChange={(e) => updateDriver(d.key, { downPct: e.target.value })} aria-label={`${d.label} downside percent`} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground/70">Up %</Label>
                        <Input type="number" step="1" className={smallFieldClass} value={f.upPct} onChange={(e) => updateDriver(d.key, { upPct: e.target.value })} aria-label={`${d.label} upside percent`} />
                      </div>
                    </div>
                  </div>
                );
              })}

              <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
                <DialogTrigger
                  render={
                    <Button
                      variant="primary-gold"
                      size="md"
                      className="mt-2 w-full"
                      trailingIcon={<FloppyDisk weight="light" />}
                    />
                  }
                >
                  Save scenario set
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Save scenario set</DialogTitle>
                    <DialogDescription>
                      Creates a versioned financial_model record (model_type =
                      scenario_stress) with the driver state as params and the
                      best / base / worst outcomes as outputs.
                    </DialogDescription>
                  </DialogHeader>
                  <form action={saveAction} className="flex flex-col gap-4">
                    <input type="hidden" name="modelType" value="scenario_stress" />
                    <input type="hidden" name="currencyCode" value="INR" />
                    <input type="hidden" name="params" value={paramsJson} />
                    <input type="hidden" name="outputs" value={outputsJson} />
                    <input type="hidden" name="engineVersion" value="scenarioAnalysis.v1" />
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="scenarioTag" className="text-[12px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                        Scenario tag (optional)
                      </Label>
                      <Input id="scenarioTag" name="scenarioTag" className={fieldClass} placeholder={`${type} / IC pre-read`} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="dealId" className="text-[12px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Deal ID (optional UUID)</Label>
                        <Input id="dealId" name="dealId" className={fieldClass} placeholder="uuid" />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="partyId" className="text-[12px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Party ID (optional UUID)</Label>
                        <Input id="partyId" name="partyId" className={fieldClass} placeholder="uuid" />
                      </div>
                    </div>
                    {saveState?.error ? <p className="text-sm text-down">{saveState.error}</p> : null}
                    <DialogFooter>
                      <Button
                        type="submit"
                        variant="primary-emerald"
                        disabled={savePending}
                        trailingIcon={savePending ? undefined : <ArrowRight weight="light" />}
                      >
                        {savePending ? "Saving…" : "Save scenario"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardBody>
          </Card>
        </Reveal>

        {/* ---------------- Outcomes + sensitivity (right) ---------------- */}
        <div className="flex flex-col gap-4 md:gap-6">
          {/* Best / Base / Worst */}
          <Reveal y={18}>
            <Card shellRadius="3xl">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <Eyebrow dot>Corner cases</Eyebrow>
                    <CardTitle>{def.label} - best / base / worst</CardTitle>
                  </div>
                  <Badge variant="outline">{cases.base.primaryLabel}</Badge>
                </div>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <CaseCard
                    label="Worst"
                    icon={<TrendDown weight="light" className="size-4" />}
                    tone="down"
                    cases={cases.worst}
                  />
                  <CaseCard
                    label="Base"
                    icon={<Sparkle weight="light" className="size-4" />}
                    tone="gold"
                    cases={cases.base}
                  />
                  <CaseCard
                    label="Best"
                    icon={<TrendUp weight="light" className="size-4" />}
                    tone="up"
                    cases={cases.best}
                  />
                </div>
              </CardBody>
            </Card>
          </Reveal>

          {/* Sensitivity heatmap */}
          <Reveal y={18} delay={0.05}>
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <CardTitle>Two-variable sensitivity</CardTitle>
                    <CardDescription>Rows = Y driver, columns = X driver. Other drivers held at base. Emerald = better than base, rose = worse.</CardDescription>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="flex flex-col gap-1">
                      <Label className="text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground/70">X (cols)</Label>
                      <Select value={xKey} onValueChange={(v) => setXKey(v as string)}>
                        <SelectTrigger className={cn(smallFieldClass, "h-9.5 w-[150px]")}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {def.drivers.map((d) => (
                            <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground/70">Y (rows)</Label>
                      <Select value={yKey} onValueChange={(v) => setYKey(v as string)}>
                        <SelectTrigger className={cn(smallFieldClass, "h-9.5 w-[150px]")}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {def.drivers.map((d) => (
                            <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardBody>
                <SensitivityHeatmap grid={grid} basePrimary={cases.base.primary} />
              </CardBody>
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Case card - best / base / worst
// ---------------------------------------------------------------------------

function CaseCard({
  label,
  icon,
  tone,
  cases: c,
}: {
  label: string;
  icon: React.ReactNode;
  tone: "up" | "down" | "gold";
  cases: ScenarioOutcome;
}) {
  const accent =
    tone === "up" ? "text-up ring-emerald/25"
    : tone === "down" ? "text-down ring-down/25"
    : "text-gold ring-gold/25";
  return (
    <div className={cn("bezel-hi flex flex-col gap-2 rounded-[calc(var(--radius-2xl)-0.375rem)] bg-surface-2/40 p-4 ring-1 md:p-5", accent)}>
      <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.2em]", accent)}>
        {icon}
        {label}
      </span>
      <LiveNumber
        value={c.primary ?? 0}
        format={(n) => (c.primary == null ? "n/a" : formatOutcome(n, c.primaryFormat, 2))}
        className={cn(
          "text-[clamp(1.6rem,1.2rem+1vw,2.2rem)] leading-none",
          tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-gold",
        )}
      />
      <span className="text-[11px] text-muted-foreground">{c.primaryLabel}</span>
      {c.secondary != null && c.secondaryLabel ? (
        <div className="mt-1 flex items-baseline justify-between border-t border-hairline pt-2">
          <span className="text-[11px] text-muted-foreground/80">{c.secondaryLabel}</span>
          <span className="nums tabular-nums text-[13px] font-medium text-foreground">
            {formatOutcome(c.secondary, c.secondaryFormat ?? "decimal", 2)}
          </span>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic sensitivity heatmap - colored relative to the base primary.
// ---------------------------------------------------------------------------

function SensitivityHeatmap({
  grid,
  basePrimary,
}: {
  grid: SensitivityGrid;
  basePrimary: number | null;
}) {
  const finite = grid.cells.flat().filter((v): v is number => v != null && Number.isFinite(v));
  if (finite.length === 0) {
    return <p className="text-[13px] text-muted-foreground">No finite outcomes across the grid.</p>;
  }
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const span = Math.max(max - min, 1e-9);
  const base = basePrimary != null && Number.isFinite(basePrimary) ? basePrimary : (min + max) / 2;

  function cellStyle(v: number | null): { bg: string; text: string } {
    if (v == null || !Number.isFinite(v)) return { bg: "var(--surface-2)", text: "var(--muted-foreground)" };
    // Advantage vs base, normalized by the grid span.
    const adv = v - base;
    const t = Math.max(-1, Math.min(1, adv / span));
    if (adv >= 0) {
      return {
        bg: `color-mix(in oklch, var(--emerald) ${10 + Math.abs(t) * 42}%, var(--surface))`,
        text: "var(--foreground)",
      };
    }
    return {
      bg: `color-mix(in oklch, var(--down) ${10 + Math.abs(t) * 42}%, var(--surface))`,
      text: "var(--foreground)",
    };
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-[11.5px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-surface px-2 py-1.5 text-left text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
              {grid.yLabel} \ {grid.xLabel}
            </th>
            {grid.xSteps.map((x, i) => (
              <th key={i} className="px-2 py-1.5 text-center nums tabular-nums text-[11px] text-muted-foreground">
                {formatDriver(x, grid.xUnit, 2)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.ySteps.map((y, j) => (
            <tr key={j}>
              <td className="sticky left-0 z-10 bg-surface px-2 py-1.5 text-left nums tabular-nums text-[11px] text-muted-foreground">
                {formatDriver(y, grid.yUnit, 2)}
              </td>
              {grid.xSteps.map((_, i) => {
                const v = grid.cells[j][i];
                const st = cellStyle(v);
                return (
                  <td
                    key={i}
                    className="rounded-md px-2 py-2 text-center nums tabular-nums font-medium ring-1 ring-hairline/40"
                    style={{ background: st.bg, color: st.text }}
                    title={`${grid.yLabel} ${formatDriver(y, grid.yUnit, 2)} · ${grid.xLabel} ${formatDriver(grid.xSteps[i], grid.xUnit, 2)} → ${formatOutcome(v, grid.format, 2)}`}
                  >
                    {v == null ? "-" : formatOutcome(v, grid.format, 2)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm" style={{ background: "color-mix(in oklch, var(--down) 40%, var(--surface))" }} />
          worse than base
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm" style={{ background: "color-mix(in oklch, var(--emerald) 40%, var(--surface))" }} />
          better than base
        </span>
        <span className="ml-auto nums">Base {formatOutcome(basePrimary, grid.format, 2)}</span>
      </div>
    </div>
  );
}