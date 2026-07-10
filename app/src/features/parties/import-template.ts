/** Canonical CSV header row for client import (download template). */
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

export function clientImportTemplateCsv(brandLabel: string): string {
  const header = CLIENT_IMPORT_HEADERS.join(",");
  const sample =
    brandLabel === "Bonds"
      ? 'Sample Bond Investor MF,Sample Bond Investor MF,investor,organization,Mumbai,Maharashtra,,,"AA",CRISIL,Priya Shah,priya@example.com,+919876543210'
      : 'Sample Infra Ltd,Sample Infra Ltd,issuer,organization,Mumbai,Maharashtra,infra,100_150,A,CRISIL,Anita Rao,anita@example.com,+919876543210';
  return `${header}\n${sample}\n`;
}
