// Reports & Export - pure-utility unit tests.
//
// Covers the CSV builder (rowsToCsv: RFC 4180 escaping, BOM, CRLF), the
// filename + Content-Disposition helpers, and the crore formatters + rating-
// tier map. These are pure functions (no DB, no Next), so they run in the node
// environment alongside the other engine tests. The route handler's query
// correctness is verified separately against the seeded DB (see the build +
// SQL smoke checks); this suite locks the serialization layer.

import { describe, expect, it } from "vitest";

import {
  rowsToCsv,
  exportFilename,
  csvDisposition,
  formatCr,
  compactCr,
  ratingTier,
  ratingTierColor,
  RATING_LADDER,
} from "@/features/reports/export";
import type { ExportColumn } from "@/features/reports/queries";

// ---------------------------------------------------------------------------
// rowsToCsv
// ---------------------------------------------------------------------------

describe("rowsToCsv", () => {
  it("writes the header row + one row per record, comma-separated", () => {
    type Row = { name: string; count: number };
    const cols: ExportColumn<Row>[] = [
      { header: "Name", value: (r) => r.name },
      { header: "Count", value: (r) => r.count },
    ];
    const csv = rowsToCsv(
      [
        { name: "Acme", count: 3 },
        { name: "Beta", count: 11 },
      ],
      cols,
    );
    // BOM + CRLF line endings (RFC 4180).
    expect(csv).toBe("﻿Name,Count\r\nAcme,3\r\nBeta,11\r\n");
  });

  it("handles empty input (header only)", () => {
    const cols: ExportColumn<{ a: string }>[] = [
      { header: "A", value: (r) => r.a },
    ];
    expect(rowsToCsv([], cols)).toBe("﻿A\r\n");
  });

  it("prefixes a UTF-8 BOM so Excel opens Indic/rupee figures correctly", () => {
    const csv = rowsToCsv([], [{ header: "X", value: () => "" }]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("uses CRLF line endings (RFC 4180)", () => {
    const csv = rowsToCsv(
      [{ x: 1 }],
      [
        { header: "X", value: (r) => r.x },
        { header: "Y", value: () => "y" },
      ],
    );
    expect(csv).toContain("\r\n");
    expect(csv).not.toContain("\n\r");
  });

  it("quotes fields containing a comma", () => {
    const csv = rowsToCsv(
      [{ v: "a,b" }],
      [{ header: "V", value: (r) => r.v }],
    );
    expect(csv).toBe('﻿V\r\n"a,b"\r\n');
  });

  it("quotes fields containing a double-quote and doubles internal quotes", () => {
    const csv = rowsToCsv(
      [{ v: 'say "hi"' }],
      [{ header: "V", value: (r) => r.v }],
    );
    expect(csv).toBe('﻿V\r\n"say ""hi"""\r\n');
  });

  it("quotes fields containing a newline or CR", () => {
    const csv = rowsToCsv(
      [{ v: "line1\nline2" }],
      [{ header: "V", value: (r) => r.v }],
    );
    expect(csv).toBe('﻿V\r\n"line1\nline2"\r\n');
  });

  it("renders null / undefined as empty cells (not the string 'null')", () => {
    const csv = rowsToCsv(
      [{ a: null as unknown as string, b: undefined as unknown as string }],
      [
        { header: "A", value: (r) => r.a },
        { header: "B", value: (r) => r.b },
      ],
    );
    expect(csv).toBe("﻿A,B\r\n,\r\n");
  });

  it("coerces numbers and booleans to strings", () => {
    const csv = rowsToCsv(
      [{ n: 42, b: true }],
      [
        { header: "N", value: (r) => r.n },
        { header: "B", value: (r) => (r.b ? "Yes" : "No") },
      ],
    );
    expect(csv).toBe("﻿N,B\r\n42,Yes\r\n");
  });
});

// ---------------------------------------------------------------------------
// exportFilename + csvDisposition
// ---------------------------------------------------------------------------

describe("exportFilename", () => {
  it("produces <prefix>-<yyyymmdd>.csv", () => {
    const f = exportFilename("pipeline-report");
    expect(f).toMatch(/^pipeline-report-\d{8}\.csv$/);
  });

  it("sanitizes unsafe characters in the prefix", () => {
    const f = exportFilename("Revenue / Report!");
    expect(f).toMatch(/^revenue-report-\d{8}\.csv$/);
    expect(f).not.toContain("/");
    expect(f).not.toContain("!");
  });

  it("falls back to 'export' for an empty/whitespace prefix", () => {
    const f = exportFilename("   ");
    expect(f).toMatch(/^export-\d{8}\.csv$/);
  });
});

describe("csvDisposition", () => {
  it("builds an attachment header with ASCII + UTF-8 encoded filename", () => {
    const d = csvDisposition("pipeline-report-20260628.csv");
    expect(d.startsWith("attachment; filename=")).toBe(true);
    expect(d).toContain("filename*=UTF-8''pipeline-report-20260628.csv");
  });

  it("replaces non-ASCII-safe characters in the legacy filename fallback", () => {
    const d = csvDisposition("résumé report.csv");
    // Legacy ASCII fallback sanitized; RFC 5987 encoded form preserves unicode.
    expect(d).toContain("filename*=" );
    expect(d).toMatch(/filename="[a-z0-9._-]+"/i);
  });
});

// ---------------------------------------------------------------------------
// Crore formatters
// ---------------------------------------------------------------------------

describe("formatCr", () => {
  it("formats a crore value as ₹{value} Cr with en-IN grouping + 2 dp", () => {
    expect(formatCr(1191.2197)).toBe("₹1,191.22 Cr");
    expect(formatCr(1272.44)).toBe("₹1,272.44 Cr");
  });

  it("returns - for null / undefined / NaN", () => {
    expect(formatCr(null)).toBe("-");
    expect(formatCr(undefined)).toBe("-");
    expect(formatCr(Number.NaN)).toBe("-");
  });

  it("honors the decimals option", () => {
    expect(formatCr(10.482, { decimals: 1 })).toBe("₹10.5 Cr");
    expect(formatCr(10.482, { decimals: 0 })).toBe("₹10 Cr");
  });
});

describe("compactCr", () => {
  it("uses ₹XXX Cr below 1,000 cr", () => {
    expect(compactCr(150)).toBe("₹150 Cr");
    expect(compactCr(999)).toBe("₹999 Cr");
  });

  it("uses ₹X.XK Cr from 1,000 cr", () => {
    expect(compactCr(1500)).toBe("₹1.5K Cr");
    expect(compactCr(92036)).toBe("₹92K Cr");
  });

  it("uses ₹X.XX T (lakh-crore / trillion) from 1,00,000 cr", () => {
    expect(compactCr(100000)).toBe("₹1T");
    expect(compactCr(150000)).toBe("₹1.5T");
  });
});

// ---------------------------------------------------------------------------
// Rating tier map
// ---------------------------------------------------------------------------

describe("ratingTier", () => {
  it("maps prime investment grades to emerald", () => {
    expect(ratingTier("AAA")).toBe("emerald");
    expect(ratingTier("AA+")).toBe("emerald");
    expect(ratingTier("AA")).toBe("emerald");
    expect(ratingTier("AA-")).toBe("emerald");
    expect(ratingTier("A+")).toBe("emerald");
    expect(ratingTier("A")).toBe("emerald");
  });

  it("maps A- (lower IG) to gold", () => {
    expect(ratingTier("A-")).toBe("gold");
  });

  it("maps BBB band (crossover) to info", () => {
    expect(ratingTier("BBB+")).toBe("info");
    expect(ratingTier("BBB")).toBe("info");
    expect(ratingTier("BBB-")).toBe("info");
  });

  it("maps high-yield / distressed (BB and below) to down", () => {
    expect(ratingTier("BB+")).toBe("down");
    expect(ratingTier("BB")).toBe("down");
    expect(ratingTier("BB-")).toBe("down");
    expect(ratingTier("B+")).toBe("down");
    expect(ratingTier("CCC")).toBe("down");
    expect(ratingTier("D")).toBe("down");
  });

  it("returns neutral for null / unknown", () => {
    expect(ratingTier(null)).toBe("neutral");
    expect(ratingTier(undefined)).toBe("neutral");
    expect(ratingTier("BC-1")).toBe("neutral");
  });
});

describe("ratingTierColor", () => {
  it("resolves each tier to its CSS var", () => {
    expect(ratingTierColor("AAA")).toBe("var(--emerald)");
    expect(ratingTierColor("A-")).toBe("var(--gold)");
    expect(ratingTierColor("BBB")).toBe("var(--info)");
    expect(ratingTierColor("BB")).toBe("var(--down)");
    expect(ratingTierColor(null)).toBe("var(--muted-foreground)");
  });
});

describe("RATING_LADDER", () => {
  it("runs from AAA to D in descending order", () => {
    expect(RATING_LADDER[0]).toBe("AAA");
    expect(RATING_LADDER[RATING_LADDER.length - 1]).toBe("D");
    // 22 standard notches.
    expect(RATING_LADDER.length).toBe(22);
  });
});
