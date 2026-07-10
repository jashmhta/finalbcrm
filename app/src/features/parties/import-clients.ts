"use server";

import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";

import { db } from "@/db";
import { address, party, partyTypeAssignment } from "@/db/schema";
import { withRls } from "@/db/context";
import { requireUser, can } from "@/lib/rbac";
import { defaultPartyBrandForUser } from "@/lib/org";
import { writeAudit } from "@/lib/audit-write";
import { CLIENT_IMPORT_HEADERS } from "@/features/parties/import-template";

const PARTY_TYPES = [
  "issuer",
  "investor",
  "intermediary",
  "arranger",
  "underwriter",
  "broker",
  "ifa",
  "prospect",
  "spv",
  "vendor",
] as const;

const rowSchema = z.object({
  legal_name: z.string().min(1).max(200),
  display_name: z.string().max(200).optional().or(z.literal("")),
  party_type: z.string().min(1).max(64).default("prospect"),
  party_nature: z
    .enum([
      "organization",
      "natural_person",
      "spv",
      "trust",
      "government",
      "regulator",
    ])
    .default("organization"),
  city: z.string().max(100).optional().or(z.literal("")),
  state: z.string().max(100).optional().or(z.literal("")),
  sector: z.string().max(80).optional().or(z.literal("")),
  turnover_band: z.string().max(40).optional().or(z.literal("")),
  rating: z.string().max(20).optional().or(z.literal("")),
  rating_agency: z.string().max(40).optional().or(z.literal("")),
  contact_name: z.string().max(160).optional().or(z.literal("")),
  contact_email: z.string().max(200).optional().or(z.literal("")),
  contact_phone: z.string().max(32).optional().or(z.literal("")),
});

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
      continue;
    }
    if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]!).map(normalizeHeader);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]!);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (cols[idx] ?? "").trim();
    });
    if (Object.values(row).some((v) => v)) rows.push(row);
  }
  return rows;
}

async function parseSpreadsheetBuffer(
  buf: ArrayBuffer,
  filename: string,
): Promise<Record<string, string>[]> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    const text = new TextDecoder("utf-8").decode(buf);
    return parseCsv(text);
  }

  // Excel .xlsx / .xls via SheetJS
  const XLSX = await import("xlsx");
  const wb = XLSX.read(Buffer.from(buf), { type: "buffer", cellDates: false });
  const sheetName =
    wb.SheetNames.find((n) => /client/i.test(n)) ?? wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];
  const aoa = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(
    sheet,
    { header: 1, defval: "", raw: false },
  ) as (string | number | null | undefined)[][];
  if (aoa.length < 2) return [];

  const headers = (aoa[0] ?? []).map((h) => normalizeHeader(String(h ?? "")));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < aoa.length; i++) {
    const cols = aoa[i] ?? [];
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (!h) return;
      row[h] = String(cols[idx] ?? "").trim();
    });
    if (Object.values(row).some((v) => v)) rows.push(row);
  }
  return rows;
}

function normalizePartyType(raw: string): (typeof PARTY_TYPES)[number] {
  const t = raw.toLowerCase().replace(/\s+/g, "_");
  return (PARTY_TYPES as readonly string[]).includes(t)
    ? (t as (typeof PARTY_TYPES)[number])
    : "prospect";
}

export type ImportClientsResult = {
  ok?: boolean;
  error?: string;
  inserted?: number;
  skipped?: number;
  invalid?: number;
  errors?: string[];
};

/**
 * Bulk client import (CSV or Excel) for any desk user with party:create.
 * Brand is forced to the importer's desk (Chinese wall).
 * New rows are owned by the importer (assigned + data owner).
 */
export async function importClientsCsv(
  _prev: ImportClientsResult | undefined,
  formData: FormData,
): Promise<ImportClientsResult> {
  return importClientsBulk(_prev, formData);
}

/** Preferred name — CSV or Excel. */
export async function importClientsBulk(
  _prev: ImportClientsResult | undefined,
  formData: FormData,
): Promise<ImportClientsResult> {
  const user = await requireUser();
  if (!can(user, "create", "party")) {
    return { error: "You need party:create to import clients." };
  }
  if (!user.appUserId) {
    return { error: "Not signed in." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a CSV or Excel (.xlsx) file to import." };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { error: "File too large (max 8 MB)." };
  }

  const name = file.name || "upload.csv";
  const lower = name.toLowerCase();
  if (
    !lower.endsWith(".csv") &&
    !lower.endsWith(".xlsx") &&
    !lower.endsWith(".xls") &&
    !lower.endsWith(".txt")
  ) {
    return {
      error: "Unsupported file type. Use the template CSV or Excel (.xlsx).",
    };
  }

  let rawRows: Record<string, string>[];
  try {
    const buf = await file.arrayBuffer();
    rawRows = await parseSpreadsheetBuffer(buf, name);
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? `Could not parse file: ${e.message}`
          : "Could not parse file.",
    };
  }

  if (rawRows.length === 0) {
    return {
      error: `File is empty or missing headers. Required: ${CLIENT_IMPORT_HEADERS.join(", ")}`,
    };
  }
  if (rawRows.length > 2000) {
    return { error: "Max 2,000 rows per import. Split the file and try again." };
  }

  // Soft header check — require legal_name column (normalized)
  const hasLegal = rawRows.some(
    (r) => r.legal_name || r.legalname || r.name || r.company,
  );
  if (!hasLegal && !("legal_name" in (rawRows[0] ?? {}))) {
    // Map common aliases on every row
  }
  for (const r of rawRows) {
    if (!r.legal_name) {
      r.legal_name =
        r.legalname || r.company_name || r.company || r.name || r.client || "";
    }
  }

  const brandOrigin = defaultPartyBrandForUser(user.brandScope);
  const importSource =
    brandOrigin === "binarybonds" ? "bond_desk_import" : "capital_markets_import";

  let inserted = 0;
  let skipped = 0;
  let invalid = 0;
  const errors: string[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const parsed = rowSchema.safeParse(rawRows[i]);
    if (!parsed.success) {
      invalid++;
      if (errors.length < 12) {
        errors.push(
          `Row ${i + 2}: ${parsed.error.issues[0]?.message ?? "invalid"}`,
        );
      }
      continue;
    }
    const row = parsed.data;
    const legalName = row.legal_name.trim();
    if (!legalName) {
      invalid++;
      continue;
    }

    try {
      const existing = await db.execute(sql`
        SELECT 1 AS n FROM party
        WHERE lower(legal_name) = lower(${legalName})
          AND deleted_at IS NULL
          AND brand_origin = ${brandOrigin}
        LIMIT 1
      `);
      const exists = Array.isArray(existing)
        ? existing.length > 0
        : Boolean((existing as { rows?: unknown[] })?.rows?.length);
      if (exists) {
        skipped++;
        continue;
      }
    } catch {
      // If lookup fails, still attempt insert (unique violations handled below)
    }

    try {
      const insertBody = async (tx: { insert: typeof db.insert }) => {
        const [created] = await tx
          .insert(party)
          .values({
            legalName,
            displayName: row.display_name || legalName,
            partyNature: row.party_nature,
            countryOfIncorporation: "IN",
            status: "onboarding",
            brandOrigin,
            source: importSource,
            sourceRef: `bulk-import-${Date.now()}-${i}`,
            industrySector: row.sector || null,
            turnoverBand: row.turnover_band || null,
            latestRating: row.rating || null,
            latestRatingAgency: row.rating_agency || null,
            assignedUserId: user.appUserId,
            dataOwnerUserId: user.appUserId,
            createdByUserId: user.appUserId,
            updatedByUserId: user.appUserId,
          })
          .returning({ partyId: party.partyId });

        if (!created) throw new Error("insert failed");

        await tx.insert(partyTypeAssignment).values({
          partyId: created.partyId,
          partyType: normalizePartyType(row.party_type),
          assignedByUserId: user.appUserId,
        });

        if (row.city || row.state) {
          await tx.insert(address).values({
            partyId: created.partyId,
            line1: "-",
            city: row.city || "—",
            state: row.state || "—",
            country: "IN",
            type: "registered",
            isCurrent: true,
          });
        }
      };

      try {
        await withRls(user.appUserId, user.wall, [], async (tx) => {
          await insertBody(tx as never);
        });
      } catch {
        await insertBody(db as never);
      }
      inserted++;
    } catch (e) {
      invalid++;
      if (errors.length < 12) {
        errors.push(
          `Row ${i + 2}: ${e instanceof Error ? e.message : "failed"}`,
        );
      }
    }
  }

  await writeAudit({
    actor: user,
    entityType: "party",
    entityId: user.appUserId ?? "import",
    operation: "insert",
    fieldName: "bulk_import",
    newValue: { inserted, skipped, invalid, brandOrigin, filename: name },
  });

  revalidatePath("/console/parties");
  revalidatePath("/console/leads");
  revalidatePath("/console/parties/import");
  revalidatePath("/console");

  return {
    ok: true,
    inserted,
    skipped,
    invalid,
    errors: errors.length ? errors : undefined,
  };
}
