/** Canonical headers for client bulk import (CSV + Excel). Order is stable. */
export const CLIENT_IMPORT_HEADERS = [
  "legal_name",
  "display_name",
  "party_type",
  "party_nature",
  "city",
  "state",
  "sector",
  "turnover_band",
  "rating",
  "rating_agency",
  "contact_name",
  "contact_email",
  "contact_phone",
] as const;

export type ClientImportHeader = (typeof CLIENT_IMPORT_HEADERS)[number];

/** Human-readable column guide for the template second sheet / README row. */
export const CLIENT_IMPORT_HEADER_GUIDE: Record<ClientImportHeader, string> = {
  legal_name: "Required. Full legal company / entity name",
  display_name: "Optional short name shown in the book",
  party_type:
    "issuer | investor | intermediary | arranger | underwriter | broker | ifa | prospect | spv | vendor",
  party_nature:
    "organization | natural_person | spv | trust | government | regulator",
  city: "City (registered)",
  state: "State / UT",
  sector: "e.g. infra, nbfc, power",
  turnover_band: "e.g. 0_50 | 50_100 | 100_150 | 150_plus",
  rating: "e.g. AAA | AA | A | BBB",
  rating_agency: "e.g. CRISIL | ICRA | CARE | India Ratings",
  contact_name: "Primary contact person",
  contact_email: "Contact email",
  contact_phone: "Contact phone (+91…)",
};

export function sampleImportRow(
  brandLabel: "Capital" | "Bonds" | "Firm",
): Record<ClientImportHeader, string> {
  if (brandLabel === "Bonds") {
    return {
      legal_name: "Sample Bond Investor MF",
      display_name: "Sample Bond Investor MF",
      party_type: "investor",
      party_nature: "organization",
      city: "Mumbai",
      state: "Maharashtra",
      sector: "",
      turnover_band: "",
      rating: "AA",
      rating_agency: "CRISIL",
      contact_name: "Priya Shah",
      contact_email: "priya@example.com",
      contact_phone: "+919876543210",
    };
  }
  return {
    legal_name: "Sample Infra Ltd",
    display_name: "Sample Infra Ltd",
    party_type: "issuer",
    party_nature: "organization",
    city: "Mumbai",
    state: "Maharashtra",
    sector: "infra",
    turnover_band: "100_150",
    rating: "A",
    rating_agency: "CRISIL",
    contact_name: "Anita Rao",
    contact_email: "anita@example.com",
    contact_phone: "+919876543210",
  };
}

export function clientImportTemplateCsv(brandLabel: "Capital" | "Bonds" | "Firm"): string {
  const header = CLIENT_IMPORT_HEADERS.join(",");
  const sample = sampleImportRow(brandLabel);
  const values = CLIENT_IMPORT_HEADERS.map((h) => {
    const v = sample[h] ?? "";
    if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  }).join(",");
  // UTF-8 BOM so Excel opens headers correctly
  return `\uFEFF${header}\n${values}\n`;
}

/** Build an .xlsx ArrayBuffer with headers + sample row (Excel-native). */
export async function clientImportTemplateXlsx(
  brandLabel: "Capital" | "Bonds" | "Firm",
): Promise<Buffer> {
  const XLSX = await import("xlsx");
  const sample = sampleImportRow(brandLabel);
  const dataRows = [
    [...CLIENT_IMPORT_HEADERS],
    CLIENT_IMPORT_HEADERS.map((h) => sample[h] ?? ""),
  ];
  const guideRows = [
    ["column", "description"],
    ...CLIENT_IMPORT_HEADERS.map((h) => [h, CLIENT_IMPORT_HEADER_GUIDE[h]]),
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(dataRows);
  ws["!cols"] = CLIENT_IMPORT_HEADERS.map((h) => ({
    wch: Math.max(14, h.length + 2),
  }));
  XLSX.utils.book_append_sheet(wb, ws, "Clients");

  const guide = XLSX.utils.aoa_to_sheet(guideRows);
  guide["!cols"] = [{ wch: 18 }, { wch: 72 }];
  XLSX.utils.book_append_sheet(wb, guide, "Column guide");

  const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return Buffer.from(out);
}
