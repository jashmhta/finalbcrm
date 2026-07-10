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

function parseCsv(text: string): Record<string, string>[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]!).map((h) =>
    h.trim().toLowerCase().replace(/\s+/g, "_"),
  );
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
 * Employee-friendly client CSV import.
 * Brand is forced to the importer's desk (Chinese wall).
 */
export async function importClientsCsv(
  _prev: ImportClientsResult | undefined,
  formData: FormData,
): Promise<ImportClientsResult> {
  const user = await requireUser();
  if (!can(user, "create", "party")) {
    return { error: "You need party:create to import clients." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a CSV file to import." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { error: "File too large (max 5 MB)." };
  }

  const text = await file.text();
  const rawRows = parseCsv(text);
  if (rawRows.length === 0) {
    return { error: "CSV is empty or missing a header row." };
  }
  if (rawRows.length > 2000) {
    return { error: "Max 2,000 rows per import. Split the file and try again." };
  }

  const brandOrigin = defaultPartyBrandForUser(user.brandScope);
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

    try {
      await withRls(
        user.appUserId ?? crypto.randomUUID(),
        user.wall,
        [],
        async (tx) => {
          const [created] = await tx
            .insert(party)
            .values({
              legalName,
              displayName: row.display_name || legalName,
              partyNature: row.party_nature,
              status: "onboarding",
              brandOrigin,
              source: "capital_markets_import",
              sourceRef: `csv-import-${Date.now()}-${i}`,
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
        },
      );
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
    fieldName: "csv_import",
    newValue: { inserted, skipped, invalid, brandOrigin },
  });

  revalidatePath("/console/parties");
  revalidatePath("/console/leads");
  revalidatePath("/console/parties/import");

  return {
    ok: true,
    inserted,
    skipped,
    invalid,
    errors: errors.length ? errors : undefined,
  };
}
