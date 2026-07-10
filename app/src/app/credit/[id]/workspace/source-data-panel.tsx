"use client";

/**
 * SourceDataPanel - the collapsible enclosure for the credit workspace's raw
 * line-item spreading grid.
 *
 * The analytical canvas (signals + ratio matrix + anchor ladder) is the
 * dominant view; the raw source-data table is demoted behind a "Source data"
 * accordion that is COLLAPSED BY DEFAULT. Expanding reveals the full
 * line-item table with the same grouped / hairline / mono treatment the
 * canvas uses - never a dense, small-type wall on first paint.
 *
 * GPU-disciplined motion: only transform + opacity are animated (the caret
 * rotates, the body fades + lifts). No height / layout tweens. The panel is a
 * client component purely for the toggle state; the table itself is rendered
 * server-side and passed in as `children` (ReactNode - never a function prop,
 * per the server→client boundary rule).
 */
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
  Eyebrow,
  Badge,
  Button,
  EmptyState,
} from "@/components/brand";
import {
  ChartLineUpIcon,
  ScalesIcon,
  CaretDownIcon,
} from "@/app/credit/credit-icons";

const EASE = [0.32, 0.72, 0, 1] as const;

export interface SourceDataPanelProps {
  /** Number of spreading line items (SPREADING_ROWS.length). */
  lineCount: number;
  /** Number of linked periods (financialStatements.length). */
  periodCount: number;
  /** Server-rendered line-item table. Only rendered when periodCount > 0. */
  children: React.ReactNode;
}

export function SourceDataPanel({
  lineCount,
  periodCount,
  children,
}: SourceDataPanelProps) {
  const [open, setOpen] = React.useState(false);
  const hasPeriods = periodCount > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <Eyebrow>
              <ChartLineUpIcon className="size-3.5" /> Source data
            </Eyebrow>
            <CardTitle className="mt-1">Line-item spreading</CardTitle>
            <CardDescription>
              Raw line items per linked period - the inputs the ratio canvas
              above is derived from. Cells read from{" "}
              <span className="nums">line_items</span> (jsonb).
            </CardDescription>
          </div>
          <div className="flex items-center gap-2.5">
            {hasPeriods ? (
              <Badge variant="neutral">
                {lineCount} lines · {periodCount} period
                {periodCount === 1 ? "" : "s"}
              </Badge>
            ) : null}
            {hasPeriods ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-expanded={open}
                aria-controls="source-data-table"
                onClick={() => setOpen((v) => !v)}
                // h-11 on mobile for a confident thumb tap on the expand/collapse
                // toggle; md:h-8 restores the compact sm desktop height.
                className="h-11 md:h-8 text-muted-foreground hover:text-foreground"
              >
                <span>{open ? "Hide source data" : "Show source data"}</span>
                <motion.span
                  animate={{ rotate: open ? 180 : 0 }}
                  transition={{ duration: 0.32, ease: EASE }}
                  className="inline-flex"
                >
                  <CaretDownIcon className="size-3.5" />
                </motion.span>
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardBody className="p-0">
        {hasPeriods ? (
          <AnimatePresence initial={false}>
            {open ? (
              <motion.div
                key="source-data-table"
                id="source-data-table"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.34, ease: EASE }}
                className="overflow-hidden"
              >
                {children}
              </motion.div>
            ) : (
              <motion.div
                key="source-data-collapsed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, ease: EASE }}
                className="px-5 py-6 md:px-6 md:py-7"
              >
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  Source data collapsed - the analytical canvas above is the
                  primary view. Expand to audit the raw{" "}
                  <span className="nums">{lineCount}</span> line items across{" "}
                  <span className="nums">{periodCount}</span>{" "}
                  <span className="nums">period{periodCount === 1 ? "" : "s"}</span>.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        ) : (
          <EmptyState
            icon={<ScalesIcon />}
            title="No statements linked yet."
            hint="Add financial statements from the Financials tab to begin spreading."
          />
        )}
      </CardBody>
    </Card>
  );
}