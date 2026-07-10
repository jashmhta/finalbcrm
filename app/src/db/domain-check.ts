// Domain-logic smoke check - exercises the real modeling/credit/scorecard
// code paths against a sample instrument and seeded DB rows, then prints
// results so a human can eyeball whether the values are sane.
//
// Run:  npx tsx src/db/domain-check.ts

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env.local before importing ./index (which builds the postgres client
// from process.env.DATABASE_URL at module-eval time). Static imports are
// hoisted above this block, so ./index must be imported DYNAMICALLY inside
// main() after the env loader has populated the env.
if (!process.env.DATABASE_URL) {
  try {
    const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of env.split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* ignore */
  }
}

import { eq, desc, sql } from "drizzle-orm";
import { computeBondMetrics } from "@/features/modeling/bondPricing";
import { computeRatios } from "@/features/credit/ratios";
import { computeScorecard } from "@/features/credit/scorecard";

function fmt(n: number | null | undefined, d = 4): string {
  if (n == null || Number.isNaN(n)) return "NaN";
  return n.toFixed(d);
}

async function main() {
  const { db } = await import("./index");
  const {
    creditAnalysis,
    creditAnalysisFsLink,
    financialStatement,
  } = await import("./schema");
  // ---------------------------------------------------------------------
  // (a) BOND PRICING - 10-year 7% semi-annual G-Sec, price from yield=7.0%.
  //     Expect: price ~ par (100), YTM == 0.07, duration > 0 and < 10y,
  //     convexity > 0, current yield ~ 7%.
  // ---------------------------------------------------------------------
  console.log("\n=== (a) BOND PRICING - 10y 7% semi-annual G-Sec @ 7.0% yield ===");
  const settlement = "2026-06-26";
  const maturity = "2036-06-26";
  const metrics = computeBondMetrics({
    instrumentType: "GSEC",
    faceValue: 100,
    couponRate: 0.07,
    couponFrequency: 2,
    dayCount: "ACT_365",
    maturityDate: maturity,
    lastCouponDate: "2025-12-26",
    nextCouponDate: "2026-12-26",
    settlementDate: settlement,
    yield: 0.07,
    benchmarkYield: 0.0685,
  });
  console.log("  cleanPrice      :", fmt(metrics.cleanPrice, 4));
  console.log("  dirtyPrice      :", fmt(metrics.dirtyPrice, 4));
  console.log("  accruedInterest :", fmt(metrics.accruedInterest, 4));
  console.log("  ytm             :", fmt(metrics.ytm, 6), "(expect ~0.07)");
  console.log("  currentYield    :", fmt(metrics.currentYield, 6));
  console.log("  macaulayDur(yrs):", fmt(metrics.macaulayDuration, 4), "(expect >0, <10)");
  console.log("  modifiedDur     :", fmt(metrics.modifiedDuration, 4));
  console.log("  convexity       :", fmt(metrics.convexity, 4), "(expect >0)");
  console.log("  dv01            :", fmt(metrics.dv01, 6));
  console.log("  gSpread (bp)    :", metrics.gSpread != null ? fmt(metrics.gSpread * 10000, 2) : "null");
  console.log("  remainingCoupons:", metrics.remainingCoupons);

  // ---------------------------------------------------------------------
  // (b) CREDIT RATIOS - compute from a seeded financial_statement.
  // ---------------------------------------------------------------------
  console.log("\n=== (b) CREDIT RATIOS - from a seeded financial_statement ===");
  const fsRows: { financialStatementId: string; lineItems: unknown }[] =
    await db
      .select({
        financialStatementId: financialStatement.financialStatementId,
        lineItems: financialStatement.lineItems,
      })
      .from(financialStatement)
      .where(sql`line_items IS NOT NULL`)
      .limit(5);
  if (fsRows.length === 0) {
    console.log("  (no financial_statements with line_items found)");
  }
  let chosenFs: { financialStatementId: string; lineItems: unknown } | undefined;
  let ratiosOut: ReturnType<typeof computeRatios> | undefined;
  for (const fs of fsRows) {
    try {
      const r = computeRatios({ lineItems: fs.lineItems as never });
      chosenFs = fs;
      ratiosOut = r;
      console.log("  fsId            :", fs.financialStatementId);
      console.log("  debt_equity     :", fmt(r.debt_equity));
      console.log("  current_ratio   :", fmt(r.current_ratio));
      console.log("  ebitda_margin   :", fmt(r.ebitda_margin));
      console.log("  interest_coverage:", fmt(r.interest_coverage));
      console.log("  roe             :", fmt(r.roe));
      console.log("  _ebitda         :", fmt(r._ebitda));
      console.log("  any NaN?        :", Object.values(r).some((v) => typeof v === "number" && Number.isNaN(v)));
      break;
    } catch (e) {
      console.log("  computeRatios threw on", fs.financialStatementId, "-", (e as Error).message);
    }
  }

  // ---------------------------------------------------------------------
  // (c) SCORECARD - score a seeded credit_analysis: pull a CA + its linked
  //     FS, compute ratios, run computeScorecard with the CA's obligorType.
  // ---------------------------------------------------------------------
  console.log("\n=== (c) SCORECARD - score a seeded credit_analysis ===");
  const caRows: { creditAnalysisId: string; partyId: string; obligorType: string }[] =
    await db
      .select({
        creditAnalysisId: creditAnalysis.creditAnalysisId,
        partyId: creditAnalysis.partyId,
        obligorType: creditAnalysis.obligorType,
      })
      .from(creditAnalysis)
      .limit(10);
  let scored = false;
  for (const ca of caRows) {
    // latest linked FS for this CA
    const link: { financialStatementId: string }[] = await db
      .select({ financialStatementId: creditAnalysisFsLink.financialStatementId })
      .from(creditAnalysisFsLink)
      .where(eq(creditAnalysisFsLink.creditAnalysisId, ca.creditAnalysisId))
      .orderBy(desc(creditAnalysisFsLink.linkedAt))
      .limit(1);
    if (link.length === 0) continue;
    const fs: { lineItems: unknown }[] = await db
      .select({ lineItems: financialStatement.lineItems })
      .from(financialStatement)
      .where(eq(financialStatement.financialStatementId, link[0]!.financialStatementId))
      .limit(1);
    if (!fs[0]?.lineItems) continue;
    const ratios = computeRatios({ lineItems: fs[0].lineItems as never });
    const result = computeScorecard({ ratios, obligorType: ca.obligorType });
    console.log("  caId            :", ca.creditAnalysisId);
    console.log("  obligorType     :", ca.obligorType);
    console.log("  totalScore      :", fmt(result.totalScore, 2), "(expect 0–100)");
    console.log("  band            :", result.band);
    console.log("  notionalGrade   :", result.notionalGrade);
    console.log("  indicativePd1y  :", fmt(result.indicativePd1y, 4));
    console.log("  subFactors      :", result.subFactors.length);
    scored = true;
    break;
  }
  if (!scored) {
    console.log("  (no credit_analysis with a linked line_items FS found)");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("domain-check failed:", err);
  process.exit(1);
});
