import Link from "next/link";

import { requireUser, can } from "@/lib/rbac";
import { defaultPartyBrandForUser } from "@/lib/org";
import { CLIENT_IMPORT_HEADERS } from "@/features/parties/import-template";
import { CPageHeader } from "@/console/patterns/page-header";
import { CCard } from "@/console/primitives/card";
import { CEmpty } from "@/console/primitives/empty";
import { ImportClientsForm } from "./import-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Import clients" };

export default async function ConsoleImportClientsPage() {
  const user = await requireUser();
  if (!can(user, "create", "party")) {
    return (
      <CEmpty
        title="No import access"
        body="You need party:create to import clients into your book. Desk employees have this by default."
        actionLabel="Client book"
        actionHref="/console/parties"
      />
    );
  }

  const brand = defaultPartyBrandForUser(user.brandScope);
  const brandLabel =
    brand === "binarybonds"
      ? "Bonds"
      : brand === "binarycapital"
        ? "Capital"
        : "Shared / firm";
  const kind = brand === "binarybonds" ? "bonds" : "capital";

  return (
    <div>
      <CPageHeader
        eyebrow="Client book"
        title="Bulk import clients"
        description={`Upload Excel or CSV into your ${brandLabel} book. Every row is assigned to you. Brand is locked automatically — Capital and Bonds stay segregated.`}
        actions={
          <Link
            href="/console/parties"
            className="inline-flex h-10 items-center rounded-[var(--c-radius-pill)] px-4 text-[13px] ring-1 ring-[var(--c-line-strong)]"
          >
            Back to book
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <CCard className="space-y-3">
          <h2 className="text-[13px] font-semibold">1. Download template</h2>
          <p className="text-[12px] text-[var(--c-ink-3)]">
            Headers match the importer exactly. Excel template includes a
            “Column guide” sheet. Max 2,000 rows per file; duplicate legal names
            in your brand are skipped.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={`/console/parties/import/template?kind=auto&format=xlsx`}
              className="inline-flex h-10 items-center rounded-[var(--c-radius-pill)] bg-[var(--c-accent)] px-4 text-[13px] font-medium text-[var(--c-on-accent)]"
            >
              Excel template (.xlsx)
            </a>
            <a
              href={`/console/parties/import/template?kind=auto&format=csv`}
              className="inline-flex h-10 items-center rounded-[var(--c-radius-pill)] bg-[var(--c-surface)] px-4 text-[13px] font-medium ring-1 ring-[var(--c-line-strong)]"
            >
              CSV template
            </a>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <a
              href="/console/parties/import/template?kind=capital&format=xlsx"
              className="text-[11px] font-medium text-[var(--c-accent)] underline-offset-2 hover:underline"
            >
              Capital sample
            </a>
            <a
              href="/console/parties/import/template?kind=bonds&format=xlsx"
              className="text-[11px] font-medium text-[var(--c-accent)] underline-offset-2 hover:underline"
            >
              Bonds sample
            </a>
          </div>
          <div className="rounded-[var(--c-radius)] bg-[var(--c-surface-2)] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c-ink-3)]">
              Required headers
            </p>
            <p className="mt-1.5 break-all font-mono text-[10px] leading-relaxed text-[var(--c-ink-2)]">
              {CLIENT_IMPORT_HEADERS.join(", ")}
            </p>
            <p className="mt-2 text-[11px] text-[var(--c-ink-3)]">
              Your desk: <strong>{brandLabel}</strong> · template kind:{" "}
              <strong>{kind}</strong>. Uploads always land in this brand.
            </p>
          </div>
        </CCard>

        <CCard>
          <h2 className="mb-3 text-[13px] font-semibold">2. Upload Excel / CSV</h2>
          <ImportClientsForm />
        </CCard>
      </div>
    </div>
  );
}
