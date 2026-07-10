import Link from "next/link";
import { alias } from "drizzle-orm/pg-core";
import { desc, eq, isNull } from "drizzle-orm";

import { requireUser, can } from "@/lib/rbac";
import { db } from "@/db";
import { party, partyDuplicateCandidate } from "@/db/schema";
import { CPageHeader } from "@/console/patterns/page-header";
import { CCard } from "@/console/primitives/card";
import { CBadge } from "@/console/primitives/badge";
import { CEmpty } from "@/console/primitives/empty";

export const dynamic = "force-dynamic";
export const metadata = { title: "Duplicates" };

export default async function ConsoleDuplicatesPage() {
  const user = await requireUser();
  if (!can(user, "read", "party")) {
    return (
      <CEmpty
        title="No access"
        body="Party read is required to review duplicates."
        actionLabel="Home"
        actionHref="/console"
      />
    );
  }

  const src = alias(party, "dup_src");
  const cand = alias(party, "dup_cand");

  const rows = await db
    .select({
      id: partyDuplicateCandidate.duplicateCandidateId,
      score: partyDuplicateCandidate.matchScore,
      rule: partyDuplicateCandidate.matchRule,
      status: partyDuplicateCandidate.status,
      sourceId: partyDuplicateCandidate.sourcePartyId,
      candidateId: partyDuplicateCandidate.candidatePartyId,
      sourceName: src.legalName,
      candidateName: cand.legalName,
    })
    .from(partyDuplicateCandidate)
    .leftJoin(src, eq(src.partyId, partyDuplicateCandidate.sourcePartyId))
    .leftJoin(cand, eq(cand.partyId, partyDuplicateCandidate.candidatePartyId))
    .where(isNull(partyDuplicateCandidate.resolvedAt))
    .orderBy(desc(partyDuplicateCandidate.createdAt))
    .limit(50);

  return (
    <div>
      <CPageHeader
        eyebrow="Data quality"
        title="Duplicate detection"
        description="Open match candidates for review. Merge remains super-admin only."
        actions={
          <Link
            href="/console/parties"
            className="inline-flex h-10 items-center rounded-[var(--c-radius-pill)] bg-[var(--c-surface)] px-4 text-[13px] font-medium ring-1 ring-[var(--c-line)]"
          >
            Client book
          </Link>
        }
      />

      {rows.length === 0 ? (
        <CEmpty
          title="No open duplicates"
          body="When import or matching finds near-matches, they appear here for review."
          actionLabel="Client book"
          actionHref="/console/parties"
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <CCard className="p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <CBadge tone="warn">score {String(r.score ?? "—")}</CBadge>
                  <CBadge tone="neutral">{r.rule ?? "match"}</CBadge>
                  <CBadge tone="info">{r.status ?? "open"}</CBadge>
                </div>
                <p className="mt-2 text-[13px] font-semibold text-[var(--c-ink)]">
                  {r.sourceName ?? r.sourceId}
                  <span className="mx-2 text-[var(--c-ink-3)]">↔</span>
                  {r.candidateName ?? r.candidateId}
                </p>
                <div className="mt-2 flex flex-wrap gap-3 text-[12px]">
                  <Link
                    href={`/console/parties/${r.sourceId}`}
                    className="font-medium text-[var(--c-accent)]"
                  >
                    Open source →
                  </Link>
                  <Link
                    href={`/console/parties/${r.candidateId}`}
                    className="font-medium text-[var(--c-accent)]"
                  >
                    Open candidate →
                  </Link>
                </div>
              </CCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
