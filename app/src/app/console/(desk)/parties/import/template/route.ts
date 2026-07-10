import { requireUser, can } from "@/lib/rbac";
import { defaultPartyBrandForUser } from "@/lib/org";
import {
  clientImportTemplateCsv,
  clientImportTemplateXlsx,
} from "@/features/parties/import-template";
import { csvDisposition } from "@/features/reports/export";

export const dynamic = "force-dynamic";

/**
 * Downloadable client import templates (CSV + Excel).
 * Query: ?kind=capital|bonds|auto  &format=csv|xlsx
 * kind=auto uses the signed-in user's desk brand.
 */
export async function GET(req: Request) {
  const user = await requireUser();
  if (!can(user, "create", "party") && !can(user, "read", "party")) {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(req.url);
  let kind = (url.searchParams.get("kind") ?? "auto").toLowerCase();
  const format = (url.searchParams.get("format") ?? "xlsx").toLowerCase();

  if (kind === "auto" || kind === "mine" || kind === "desk") {
    const b = defaultPartyBrandForUser(user.brandScope);
    kind = b === "binarybonds" ? "bonds" : "capital";
  }

  const brandLabel =
    kind === "bonds" ? "Bonds" : kind === "firm" ? "Firm" : "Capital";

  if (format === "csv") {
    const csv = clientImportTemplateCsv(brandLabel);
    const filename =
      kind === "bonds"
        ? "binary-bonds-clients-import-template.csv"
        : kind === "firm"
          ? "binary-firm-clients-import-template.csv"
          : "binary-capital-clients-import-template.csv";

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": csvDisposition(filename),
        "Cache-Control": "no-store",
      },
    });
  }

  const xlsx = await clientImportTemplateXlsx(brandLabel);
  const filename =
    kind === "bonds"
      ? "binary-bonds-clients-import-template.xlsx"
      : kind === "firm"
        ? "binary-firm-clients-import-template.xlsx"
        : "binary-capital-clients-import-template.xlsx";

  return new Response(new Uint8Array(xlsx), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
