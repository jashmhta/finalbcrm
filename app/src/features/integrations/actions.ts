"use server";

// Server Actions for the /integrations page.
//
// Marked "use server" per Next.js 16 App Router conventions. Input is zod-
// validated; output is the JSON-serializable AdapterResult. No DB writes -
// these are read/demo calls against the in-process adapter registry.
//
// Two families are exported:
//   • `runIntegrationMock` / `runAllIntegrationMocks` - preserved mock-only
//     flows used by the existing /integrations UI ("Run" / "Run all"). Always
//     return the realistic sample payloads.
//   • `runIntegration` / `runAllIntegrations` - production dispatch: mock in
//     dev (or when `USE_MOCK_INTEGRATIONS=true`), real upstream when mock
//     mode is off AND credentials are present. Errors are surfaced as
//     `ok:false` AdapterResults with a structured `errorCode`.

import { z } from "zod/v4";

import { can, requireUser, type CrmUser } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit-write";
import {
  runAdapter,
  runAdapterMock,
  runAll as runAllAdapters,
  runMock as runAllMocks,
} from "./registry";
import type { AdapterResult } from "./types";

const runOneSchema = z.object({
  id: z.string().min(1).max(64),
  identifier: z.string().max(64).optional(),
  context: z.record(z.string(), z.string()).optional(),
});

function invalidResult(input: { id?: string }, message: string): AdapterResult<null> {
  return {
    adapter: input.id ?? "unknown",
    name: input.id ?? "unknown",
    ok: false,
    status: "mock",
    fetchedAt: new Date().toISOString(),
    summary: "Invalid input",
    data: null,
    error: message,
  };
}

function denyResult(message: string): AdapterResult<null> {
  return {
    adapter: "rbac",
    name: "rbac",
    ok: false,
    status: "mock",
    fetchedAt: new Date().toISOString(),
    summary: "Forbidden",
    data: null,
    error: message,
  };
}

/** Require integration:run (or admin). Live runs also need integration:live. */
function assertIntegrationAccess(
  user: CrmUser,
  mode: "mock" | "live",
): AdapterResult<null> | null {
  if (!can(user, "run", "integration") && !can(user, "read", "integration")) {
    return denyResult("You do not have permission to run integrations.");
  }
  if (mode === "live" && !can(user, "live", "integration") && !can(user, "run", "integration")) {
    // admin/super still pass via can() bypass in rbac-core
    if (!user.roles?.includes("admin") && !user.roles?.includes("super_admin")) {
      return denyResult("You do not have permission to run live integrations.");
    }
  }
  return null;
}

/* ── Mock-only flows (preserved for the /integrations UI) ────────────────── */

/** Run a single adapter's mock. Requires integration:run|read. */
export async function runIntegrationMock(input: {
  id: string;
  identifier?: string;
  context?: Record<string, string>;
}): Promise<AdapterResult> {
  const user = await requireUser();
  const denied = assertIntegrationAccess(user, "mock");
  if (denied) return denied;
  const parsed = runOneSchema.safeParse(input);
  if (!parsed.success) {
    return invalidResult(input, parsed.error.message);
  }
  return runAdapterMock(parsed.data.id, {
    identifier: parsed.data.identifier,
    context: parsed.data.context,
  });
}

/** Run every adapter's mock (the "Run all mocks" button). */
export async function runAllIntegrationMocks(): Promise<AdapterResult[]> {
  const user = await requireUser();
  const denied = assertIntegrationAccess(user, "mock");
  if (denied) return [denied];
  return runAllMocks();
}

/* ── Production dispatch (mock in dev, real when wired) ──────────────────── */

/** Run a single adapter via its production dispatch. */
export async function runIntegration(input: {
  id: string;
  identifier?: string;
  context?: Record<string, string>;
}): Promise<AdapterResult> {
  const user = await requireUser();
  const denied = assertIntegrationAccess(user, "live");
  if (denied) return denied;
  const parsed = runOneSchema.safeParse(input);
  if (!parsed.success) {
    return invalidResult(input, parsed.error.message);
  }
  const result = await runAdapter(parsed.data.id, {
    identifier: parsed.data.identifier,
    context: parsed.data.context,
  });
  await writeAudit({
    actor: user,
    entityType: "integration",
    operation: "insert",
    fieldName: parsed.data.id,
    newValue: {
      ok: result.ok,
      status: result.status,
      identifier: parsed.data.identifier ?? null,
    },
  });
  return result;
}

/** Run every adapter via its production dispatch. */
export async function runAllIntegrations(): Promise<AdapterResult[]> {
  const user = await requireUser();
  const denied = assertIntegrationAccess(user, "live");
  if (denied) return [denied];
  const results = await runAllAdapters();
  await writeAudit({
    actor: user,
    entityType: "integration",
    operation: "insert",
    fieldName: "run_all",
    newValue: { count: results.length },
  });
  return results;
}
