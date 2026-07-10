import Link from "next/link";

import { requireUser, can } from "@/lib/rbac";
import { defaultPartyBrandForUser } from "@/lib/org";
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
        body="You need party:create to import clients into your book."
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

  return (
    <div>
      <CPageHeader
        eyebrow="Client book"
        title="Import clients"
        description={`Upload a CSV into your ${brandLabel} book. Brand is locked automatically — Capital and Bonds data stay segregated.`}
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
            Use the brand-specific template so columns match. Max 2,000 rows per
            file. Existing legal names in your brand are skipped.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href="/console/parties/import/template?kind=capital"
              className="inline-flex h-10 items-center rounded-[var(--c-radius-pill)] bg-[var(--c-surface)] px-4 text-[13px] font-medium ring-1 ring-[var(--c-line-strong)]"
            >
              Capital clients template
            </a>
            <a
              href="/console/parties/import/template?kind=bonds"
              className="inline-flex h-10 items-center rounded-[var(--c-radius-pill)] bg-[var(--c-surface)] px-4 text-[13px] font-medium ring-1 ring-[var(--c-line-strong)]"
            >
              Bonds clients template
            </a>
          </div>
          <p className="text-[11px] text-[var(--c-ink-3)]">
            Your uploads still land in <strong>{brandLabel}</strong> regardless
            of which template sample you start from.
          </p>
        </CCard>

        <CCard>
          <h2 className="mb-3 text-[13px] font-semibold">2. Upload CSV</h2>
          <ImportClientsForm />
        </CCard>
      </div>
    </div>
  );
}
