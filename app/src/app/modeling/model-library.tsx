"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Calculator,
  ChartBar,
  Cube,
  MagnifyingGlass,
  Sparkle,
  X,
} from "@phosphor-icons/react";

import type { Density } from "@/components/brand/table";
import { Button } from "@/components/brand/button";
import { Badge } from "@/components/brand/badge";
import { Card } from "@/components/brand/card";
import { Eyebrow } from "@/components/brand/text";
import { Reveal, Stagger, StaggerItem } from "@/components/brand/reveal";
import { CommandBar } from "@/components/brand/command-bar";
import { PageShell, PageHeader } from "@/components/brand/page-shell";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/brand/table";

export interface ModelLibraryRow {
  financialModelId: string;
  modelType: string;
  version: number;
  scenarioTag: string | null;
  currencyCode: string | null;
  dealCode: string | null;
  dealName: string | null;
  partyName: string | null;
  computedAt: string | null;
  headline: string;
}

const TYPE_LABEL: Record<string, string> = {
  bond_pricing: "Bond pricing",
  project_finance: "Project finance",
  securitization: "Securitization",
  dcf: "DCF / valuation",
  m_and_a: "M&A",
  lbo: "LBO",
  valuation: "Valuation",
  portfolio_construction: "Portfolio",
  scenario_stress: "Scenario / stress",
};

const TYPE_TONE: Record<string, "emerald" | "gold" | "neutral" | "info"> = {
  bond_pricing: "gold",
  project_finance: "emerald",
  securitization: "info",
  dcf: "neutral",
  m_and_a: "neutral",
  lbo: "neutral",
  valuation: "neutral",
  portfolio_construction: "emerald",
  scenario_stress: "neutral",
};

const QUICK_CARDS: {
  label: string;
  title: string;
  hint: string;
  href: string;
  icon: React.ReactNode;
  tone: "gold" | "emerald" | "neutral";
}[] = [
  {
    label: "Bond pricing",
    title: "Open calculator",
    hint: "Price → YTM, duration, DV01, G-spread",
    href: "/modeling/bond-calculator",
    icon: <Calculator weight="light" />,
    tone: "gold",
  },
  {
    label: "Project finance",
    title: "Quick Debt Service Coverage Ratio / debt sizing",
    hint: "Coming soon",
    href: "/modeling",
    icon: <Cube weight="light" />,
    tone: "emerald",
  },
  {
    label: "DCF / valuation",
    title: "Quick WACC + FCFF",
    hint: "Coming soon",
    href: "/modeling",
    icon: <ChartBar weight="light" />,
    tone: "neutral",
  },
  {
    label: "Securitization",
    title: "Tranche CE sizing",
    hint: "Coming soon",
    href: "/modeling",
    icon: <Sparkle weight="light" />,
    tone: "neutral",
  },
];

export function ModelLibrary({
  rows,
  total,
}: {
  rows: ModelLibraryRow[];
  total: number;
}) {
  const [search, setSearch] = React.useState("");
  const [density, setDensity] = React.useState<Density>("comfortable");

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.financialModelId, r.modelType, r.scenarioTag, r.dealCode, r.dealName, r.partyName, r.headline]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q)),
    );
  }, [rows, search]);

  return (
    <PageShell>
      <PageHeader
        title="Modeling"
        description={`${total} model${total === 1 ? "" : "s"} — versioned, linked to deals and parties.`}
        action={
          <Button
            asChild
            variant="primary-gold"
            size="md"
            trailingIcon={<ArrowRight weight="light" />}
          >
            <Link href="/modeling/bond-calculator">Bond calculator</Link>
          </Button>
        }
      />

      {/* Quick-access instrument cards */}
      <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" amount={0.1}>
        {QUICK_CARDS.map((c) => (
          <StaggerItem key={c.label}>
            <Card interactive className="h-full">
              <Link
                href={c.href}
                className="group/quick flex h-full flex-col gap-3 p-5"
              >
                <div className="flex items-center justify-between">
                  <Eyebrow>{c.label}</Eyebrow>
                  <span
                    className={
                      c.tone === "gold"
                        ? "text-gold [&_svg]:size-5"
                        : c.tone === "emerald"
                          ? "text-emerald [&_svg]:size-5"
                          : "text-muted-foreground/70 [&_svg]:size-5"
                    }
                  >
                    {c.icon}
                  </span>
                </div>
                <div className="flex flex-1 flex-col justify-end gap-1">
                  <span className="inline-flex items-center gap-1 text-[14px] font-medium text-foreground transition-transform duration-300 ease-soft group-hover/quick:translate-x-0.5">
                    {c.title}
                    <ArrowRight
                      weight="light"
                      className="size-4 text-muted-foreground transition-transform duration-300 ease-soft group-hover/quick:translate-x-1"
                    />
                  </span>
                  {c.hint === "Coming soon" ? (
                    <span className="inline-flex w-fit items-center rounded-full border border-hairline px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/60">
                      Coming soon
                    </span>
                  ) : (
                    <span className="text-[12px] text-muted-foreground/80">
                      {c.hint}
                    </span>
                  )}
                </div>
              </Link>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>

      <Reveal y={14} delay={0.05}>
        <CommandBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search models, deals, parties…"
          density={density}
          onDensityChange={setDensity}
          label="Library"
          filters={
            <Badge variant="outline" icon={<MagnifyingGlass weight="light" />}>
              {filtered.length} of {total}
            </Badge>
          }
        />
      </Reveal>

      <Reveal y={14} delay={0.08}>
        <Card>
          <div className="flex flex-col gap-3 px-5 pt-5 md:px-6 md:pt-6">
            <Eyebrow dot>Model library</Eyebrow>
            <p className="text-[13px] text-muted-foreground">
              Every model is a first-class object - type, version, linked deal
              &amp; party, headline output.
            </p>
          </div>
          <div className="pt-4">
            {filtered.length === 0 ? (
              <TableEmpty
                icon={<X weight="light" />}
                title={search ? "No models match that search." : "The library is quiet."}
                hint={
                  search
                    ? "Try clearing the search or use the bond calculator to create the first model."
                    : "Run the bond calculator and save a result to create the first model."
                }
              />
            ) : (
              <Table density={density}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Type</TableHead>
                    {/* Version / Scenario / Linked deal / Party / Computed are
                        secondary on phones - hidden < md so the 8-col library
                        collapses to Model + Type + Headline (identity, kind,
                        result - what a mobile reader scans for). The detail
                        page carries the full provenance. */}
                    <TableHead align="right" className="hidden md:table-cell">Version</TableHead>
                    <TableHead className="hidden md:table-cell">Scenario</TableHead>
                    <TableHead className="hidden md:table-cell">Linked deal</TableHead>
                    <TableHead className="hidden md:table-cell">Party</TableHead>
                    <TableHead>Headline</TableHead>
                    <TableHead align="right" className="hidden md:table-cell">Computed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.financialModelId}>
                      <TableCell primary className="nums text-xs">
                        <Link
                          href={`/modeling/${r.financialModelId}`}
                          className="transition-colors duration-200 ease-soft hover:text-emerald"
                        >
                          {r.financialModelId.slice(0, 8)}…
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={TYPE_TONE[r.modelType] ?? "neutral"}>
                          {TYPE_LABEL[r.modelType] ?? r.modelType}
                        </Badge>
                      </TableCell>
                      <TableCell numeric className="hidden md:table-cell">
                        <Badge variant="outline">v{r.version}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{r.scenarioTag ?? "-"}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {r.dealCode ?? r.dealName ?? (
                          <span className="text-[12px] text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {r.partyName ?? (
                          <span className="text-[12px] text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{r.headline}</TableCell>
                      <TableCell numeric className="hidden md:table-cell text-muted-foreground">
                        {r.computedAt
                          ? new Date(r.computedAt).toLocaleDateString("en-IN", {
                              year: "numeric",
                              month: "short",
                              day: "2-digit",
                            })
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </Card>
      </Reveal>
    </PageShell>
  );
}