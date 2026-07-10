/**
 * Unit + structural guarantees for console href mapping.
 * Drives the shipped `toConsoleHref` / `consolePageRelForHref` helpers and
 * asserts mapped targets exist under src/app/console (no silent 404s).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  consolePageRelForHref,
  toConsoleHref,
} from "@/console/lib/console-href";

const CONSOLE_APP = join(process.cwd(), "src/app/console");
const SAMPLE_UUID = "11111111-2222-4333-8444-555555555555";

/** Legacy hrefs emitted by calendar, AI next-actions, and workflow engine. */
const LEGACY_OPEN_HREFS = [
  `/tasks/${SAMPLE_UUID}`,
  `/interactions/${SAMPLE_UUID}`,
  `/deals/${SAMPLE_UUID}`,
  `/parties/${SAMPLE_UUID}`,
  `/leads/${SAMPLE_UUID}`,
  `/credit/${SAMPLE_UUID}`,
  `/credit/${SAMPLE_UUID}/workspace`,
  `/modeling/${SAMPLE_UUID}`,
  `/compliance/kyc/${SAMPLE_UUID}`,
  `/matching/${SAMPLE_UUID}`,
  `/onboarding/${SAMPLE_UUID}`,
  `/documents/${SAMPLE_UUID}`,
  "/deals",
  "/tasks",
  "/compliance/consent",
  "/compliance/kyc",
  "/parties",
  "/credit",
] as const;

function pageExistsForConsoleHref(href: string): boolean {
  const rel = consolePageRelForHref(href);
  if (!rel) return false;
  return existsSync(join(CONSOLE_APP, rel));
}

describe("toConsoleHref maps only to live console surfaces", () => {
  it("maps task and interaction detail to console [id] routes", () => {
    expect(toConsoleHref(`/tasks/${SAMPLE_UUID}`)).toBe(
      `/console/tasks/${SAMPLE_UUID}`,
    );
    expect(toConsoleHref(`/interactions/${SAMPLE_UUID}`)).toBe(
      `/console/interactions/${SAMPLE_UUID}`,
    );
  });

  it("maps credit/deal/party/kyc detail under /console", () => {
    expect(toConsoleHref(`/credit/${SAMPLE_UUID}`)).toBe(
      `/console/credit/${SAMPLE_UUID}`,
    );
    expect(toConsoleHref(`/deals/${SAMPLE_UUID}`)).toBe(
      `/console/deals/${SAMPLE_UUID}`,
    );
    expect(toConsoleHref(`/parties/${SAMPLE_UUID}`)).toBe(
      `/console/parties/${SAMPLE_UUID}`,
    );
    expect(toConsoleHref(`/compliance/kyc/${SAMPLE_UUID}`)).toBe(
      `/console/compliance/kyc/${SAMPLE_UUID}`,
    );
  });

  it("does not invent dead console detail for unsupported modules", () => {
    // documents: list only
    expect(toConsoleHref(`/documents/${SAMPLE_UUID}`)).toBe("/console/documents");
    // consent: no console page → compliance KYC queue
    expect(toConsoleHref("/compliance/consent")).toBe("/console/compliance/kyc");
    // random unknown path → home, not /console/foo/bar
    expect(toConsoleHref("/totally/unknown/path")).toBe("/console");
  });

  it("leaves console paths and absolute URLs intact", () => {
    expect(toConsoleHref(`/console/tasks/${SAMPLE_UUID}`)).toBe(
      `/console/tasks/${SAMPLE_UUID}`,
    );
    expect(toConsoleHref("https://example.com/x")).toBe("https://example.com/x");
  });

  it("handles empty / hash", () => {
    expect(toConsoleHref(null)).toBe("/console");
    expect(toConsoleHref(undefined)).toBe("/console");
    expect(toConsoleHref("#")).toBe("/console");
  });

  it("preserves query strings on mapped routes", () => {
    expect(toConsoleHref(`/tasks/${SAMPLE_UUID}?from=cal`)).toBe(
      `/console/tasks/${SAMPLE_UUID}?from=cal`,
    );
  });
});

describe("mapped open-record targets exist under src/app/console", () => {
  for (const legacy of LEGACY_OPEN_HREFS) {
    it(`file exists for ${legacy} → ${toConsoleHref(legacy)}`, () => {
      const mapped = toConsoleHref(legacy);
      expect(mapped.startsWith("/console")).toBe(true);
      const rel = consolePageRelForHref(mapped);
      expect(rel, `rel for ${mapped}`).toBeTruthy();
      const full = join(CONSOLE_APP, rel!);
      expect(existsSync(full), full).toBe(true);
    });
  }

  it("calendar/AI/workflow sample open set all resolve to existing pages", () => {
    const missing: string[] = [];
    for (const legacy of LEGACY_OPEN_HREFS) {
      if (!pageExistsForConsoleHref(toConsoleHref(legacy))) {
        missing.push(`${legacy} → ${toConsoleHref(legacy)}`);
      }
    }
    expect(missing, missing.join("; ")).toEqual([]);
  });
});
