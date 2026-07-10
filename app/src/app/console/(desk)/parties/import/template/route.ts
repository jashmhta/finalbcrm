import { requireUser, can } from "@/lib/rbac";
import { clientImportTemplateCsv } from "@/features/parties/import-template";
import { csvDisposition } from "@/features/reports/export";

export const dynamic = "force-dynamic";

/** Downloadable client import templates (Capital / Bonds samples). */
export async function GET(req: Request) {
  const user = await requireUser();
  if (!can(user, "create", "party") && !can(user, "read", "party")) {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(req.url);
  const kind = (url.searchParams.get("kind") ?? "capital").toLowerCase();
  const brandLabel = kind === "bonds" ? "Bonds" : "Capital";
  const csv = clientImportTemplateCsv(brandLabel);
  const filename =
    kind === "bonds"
      ? "binary-bonds-clients-import-template.csv"
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
