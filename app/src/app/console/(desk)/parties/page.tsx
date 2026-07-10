import Link from "next/link";
import { cookies } from "next/headers";

import { requireUser, can } from "@/lib/rbac";
import { listParties } from "@/features/parties/queries";
import {
  CONSOLE_BRAND_COOKIE,
  parseBrandPref,
} from "@/console/lib/brand-pref";
import { resolveConsoleBrand } from "@/console/rbac/nav";
import { CPageHeader } from "@/console/patterns/page-header";
import { CCard } from "@/console/primitives/card";
import { CBadge } from "@/console/primitives/badge";
import { CEmpty } from "@/console/primitives/empty";
import { NewPartyForm } from "./new-form";
import { PartyFiltersForm } from "./filters";

export const dynamic = "force-dynamic";
export const metadata = { title: "Parties" };

export default async function ConsolePartiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  if (!can(user, "read", "party")) {
    return (
      <CEmpty
        title="No access to parties"
        body="Your role does not include party:read. Ask an admin to grant access."
      />
    );
  }

  const sp = await searchParams;
  const showCreate = sp.new === "1" && can(user, "create", "party");
  const q = sp.q?.trim() || undefined;

  const jar = await cookies();
  const brandPref = parseBrandPref(jar.get(CONSOLE_BRAND_COOKIE)?.value);
  const brand = resolveConsoleBrand({
    brandScope: user.brandScope,
    roles: user.roles,
    brandPref,
  });
  const book =
    brand === "binarybonds"
      ? "investor"
      : brand === "binarycapital"
        ? "issuer"
        : "all";

  const filters = {
    turnover: sp.turnover || undefined,
    sector: sp.sector || undefined,
    rating: sp.rating || undefined,
    agency: sp.agency || undefined,
    ratingYear: sp.ratingYear ? Number(sp.ratingYear) : undefined,
    investorType: sp.investorType || undefined,
    portfolioSize: sp.portfolioSize || undefined,
    riskAppetite: sp.riskAppetite || undefined,
    highYield:
      sp.highYield === "1" ? true : sp.highYield === "0" ? false : undefined,
    type: sp.type || undefined,
  };

  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = 25;
  const { rows, total } = await listParties({
    user,
    page,
    pageSize,
    q,
    filters,
  });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    for (const [k, v] of Object.entries(filters)) {
      if (v === undefined || v === null || v === "") continue;
      params.set(k, String(v));
    }
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/console/parties?${s}` : "/console/parties";
  }

  return (
    <div>
      <CPageHeader
        eyebrow="Master data"
        title={book === "investor" ? "Investor book" : "Client book"}
        description={`${total.toLocaleString("en-IN")} counterparties in your brand scope · RBAC-segregated.`}
        actions={
          <div className="flex flex-wrap gap-2">
            {can(user, "create", "party") ? (
              <Link
                href="/console/parties/import"
                className="inline-flex h-10 items-center rounded-[var(--c-radius-pill)] bg-[var(--c-surface)] px-4 text-[13px] font-medium ring-1 ring-[var(--c-line-strong)]"
              >
                Import CSV
              </Link>
            ) : null}
            <Link
              href="/console/duplicates"
              className="inline-flex h-10 items-center rounded-[var(--c-radius-pill)] bg-[var(--c-surface)] px-4 text-[13px] font-medium ring-1 ring-[var(--c-line-strong)]"
            >
              Duplicates
            </Link>
            {can(user, "create", "party") ? (
              showCreate ? (
                <Link
                  href="/console/parties"
                  className="inline-flex h-10 items-center rounded-[var(--c-radius-pill)] bg-[var(--c-surface)] px-4 text-[13px] font-medium ring-1 ring-[var(--c-line-strong)]"
                >
                  Cancel
                </Link>
              ) : (
                <Link
                  href="/console/parties?new=1"
                  className="inline-flex h-10 items-center rounded-[var(--c-radius-pill)] bg-[var(--c-accent)] px-4 text-[13px] font-medium text-[var(--c-on-accent)]"
                >
                  New party
                </Link>
              )
            ) : null}
          </div>
        }
      />

      {showCreate ? (
        <div className="mb-6 max-w-lg">
          <h2 className="mb-3 text-[14px] font-semibold text-[var(--c-ink)]">
            Create party
          </h2>
          <NewPartyForm />
        </div>
      ) : null}

      <PartyFiltersForm
        book={book}
        filters={{
          q,
          turnover: sp.turnover,
          sector: sp.sector,
          rating: sp.rating,
          agency: sp.agency,
          ratingYear: sp.ratingYear,
          investorType: sp.investorType,
          portfolioSize: sp.portfolioSize,
          riskAppetite: sp.riskAppetite,
          highYield: sp.highYield,
          type: sp.type,
        }}
      />

      {rows.length === 0 && !showCreate ? (
        <CEmpty
          title="No parties yet"
          body="Create the first counterparty for your desk book."
          actionLabel={can(user, "create", "party") ? "New party" : undefined}
          actionHref={
            can(user, "create", "party") ? "/console/parties?new=1" : undefined
          }
        />
      ) : rows.length === 0 && showCreate ? (
        <p className="text-[13px] text-[var(--c-ink-3)]">
          No existing parties match — fill the form above to create one.
        </p>
      ) : (
        <CCard className="overflow-hidden p-0 md:p-0">
          {/* Desktop table only — min-width table was clipping columns on mobile */}
          <div className="hidden overflow-x-auto md:block">
            <table className="c-table w-full min-w-[640px] text-left text-[13px]">
              <thead className="sticky top-0 bg-[var(--c-surface)]">
                <tr className="border-b border-[var(--c-line)] text-[11px] uppercase tracking-wide text-[var(--c-ink-3)]">
                  <th className="px-4 py-3 font-medium">Legal name</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Types</th>
                  <th className="px-4 py-3 font-medium">KYC</th>
                  <th className="px-4 py-3 font-medium text-right">Rating</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr
                    key={p.partyId}
                    className="border-b border-[var(--c-line)] last:border-0 hover:bg-[var(--c-surface-2)]/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/console/parties/${p.partyId}`}
                        prefetch={false}
                        className="font-medium text-[var(--c-ink)] hover:text-[var(--c-accent)]"
                      >
                        {p.legalName}
                      </Link>
                      {p.displayName && p.displayName !== p.legalName ? (
                        <p className="text-[12px] text-[var(--c-ink-3)]">
                          {p.displayName}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <CBadge tone="neutral">{p.status}</CBadge>
                    </td>
                    <td className="px-4 py-3 text-[var(--c-ink-2)]">
                      {(p.types ?? []).slice(0, 2).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <CBadge tone={p.isKycComplete ? "ok" : "warn"}>
                        {p.isKycComplete ? "Complete" : "Open"}
                      </CBadge>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[12px] text-[var(--c-ink-3)]">
                      {p.latestRating ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile card list */}
          <ul className="divide-y divide-[var(--c-line)] md:hidden">
            {rows.map((p) => (
              <li key={`m-${p.partyId}`}>
                <Link
                  href={`/console/parties/${p.partyId}`}
                  prefetch={false}
                  className="flex items-start justify-between gap-3 px-4 py-3.5 active:bg-[var(--c-surface-2)]/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[var(--c-ink)]">
                      {p.legalName}
                    </p>
                    <p className="mt-0.5 text-[12px] text-[var(--c-ink-3)]">
                      {p.status}
                      {(p.types ?? []).length
                        ? ` · ${(p.types ?? []).slice(0, 2).join(", ")}`
                        : ""}
                      {p.latestRating ? ` · ${p.latestRating}` : ""}
                    </p>
                  </div>
                  <CBadge tone={p.isKycComplete ? "ok" : "warn"}>
                    {p.isKycComplete ? "KYC" : "Open"}
                  </CBadge>
                </Link>
              </li>
            ))}
          </ul>
        </CCard>
      )}

      {total > pageSize ? (
        <nav
          className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[13px]"
          aria-label="Pagination"
        >
          <p className="text-[var(--c-ink-3)]">
            Page {page} of {totalPages.toLocaleString("en-IN")} ·{" "}
            {total.toLocaleString("en-IN")} parties
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={pageHref(page - 1)}
                className="inline-flex h-9 items-center rounded-[var(--c-radius-pill)] px-4 ring-1 ring-[var(--c-line-strong)]"
                prefetch={false}
              >
                Previous
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link
                href={pageHref(page + 1)}
                className="inline-flex h-9 items-center rounded-[var(--c-radius-pill)] bg-[var(--c-accent)] px-4 font-medium text-[var(--c-on-accent)]"
                prefetch={false}
              >
                Next
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
