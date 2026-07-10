import { redirect } from "next/navigation";
import Link from "next/link";

import { requireUser } from "@/lib/rbac";
import { isSuperAdmin } from "@/lib/org";
import { db } from "@/db";
import { party } from "@/db/schema";
import { isNull, sql } from "drizzle-orm";
import { CPageHeader } from "@/console/patterns/page-header";
import { CCard } from "@/console/primitives/card";
import { CBadge } from "@/console/primitives/badge";
import { SettingsForms } from "./settings-forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function ConsoleSettingsPage() {
  const user = await requireUser();
  if (!isSuperAdmin(user.roles)) {
    redirect("/console");
  }

  const [totals] = await db
    .select({
      all: sql<number>`count(*) filter (where ${party.deletedAt} is null)::int`,
      scale: sql<number>`count(*) filter (where ${party.deletedAt} is null and ${party.sourceRef} = 'seed-scale')::int`,
      mock: sql<number>`count(*) filter (where ${party.deletedAt} is null and (${party.sourceRef} like 'MOCK-%' or ${party.legalName} like 'MOCK %'))::int`,
      capital: sql<number>`count(*) filter (where ${party.deletedAt} is null and ${party.brandOrigin} = 'binarycapital')::int`,
      bonds: sql<number>`count(*) filter (where ${party.deletedAt} is null and ${party.brandOrigin} = 'binarybonds')::int`,
    })
    .from(party);

  const sampleParties = await db
    .select({
      partyId: party.partyId,
      legalName: party.legalName,
      status: party.status,
      brandOrigin: party.brandOrigin,
    })
    .from(party)
    .where(isNull(party.deletedAt))
    .orderBy(party.legalName)
    .limit(30);

  return (
    <div className="space-y-6">
      <CPageHeader
        eyebrow="Super admin · password required"
        title="Settings · edit / delete / clear data"
        description="Edit any client, soft-delete, or wipe mock / scale / all clients. Every destructive action re-asks for your login password."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Active clients", value: totals?.all ?? 0 },
          { label: "Capital book", value: totals?.capital ?? 0 },
          { label: "Bonds book", value: totals?.bonds ?? 0 },
          { label: "Scale seed", value: totals?.scale ?? 0 },
          { label: "Mock rows", value: totals?.mock ?? 0 },
        ].map((k) => (
          <CCard key={k.label} className="p-3">
            <p className="text-[11px] text-[var(--c-ink-3)]">{k.label}</p>
            <p className="text-[20px] font-semibold tabular-nums">
              {Number(k.value).toLocaleString("en-IN")}
            </p>
          </CCard>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CCard className="space-y-3">
          <h2 className="text-[13px] font-semibold">Important firm links</h2>
          <ul className="space-y-2 text-[13px]">
            <li>
              <Link className="text-[var(--c-accent)]" href="/console/admin">
                Users & roles
              </Link>
            </li>
            <li>
              <Link className="text-[var(--c-accent)]" href="/console/reports">
                Super export packs
              </Link>
            </li>
            <li>
              <Link
                className="text-[var(--c-accent)]"
                href="/console/assignments"
              >
                Assignment approval queue
              </Link>
            </li>
            <li>
              <Link
                className="text-[var(--c-accent)]"
                href="/console/parties/import"
              >
                Client import templates
              </Link>
            </li>
            <li>
              <Link className="text-[var(--c-accent)]" href="/console/search">
                Firm search engine
              </Link>
            </li>
            <li>
              <Link className="text-[var(--c-accent)]" href="/console/activity">
                Coverage supervision
              </Link>
            </li>
          </ul>
          <div className="rounded-[var(--c-radius)] bg-[var(--c-surface-2)] p-3 text-[12px] text-[var(--c-ink-2)]">
            <p className="font-medium text-[var(--c-ink)]">Runtime notes</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>
                AUTH_URL / AUTH_SECRET must match the public Vercel domain
              </li>
              <li>DATABASE_URL = Neon pooler connection (Vercel env)</li>
              <li>
                Brand wall: employees cannot assign across Capital ↔ Bonds
              </li>
              <li>CSV export is super_admin only</li>
            </ul>
          </div>
        </CCard>

        <CCard>
          <h2 className="mb-2 text-[13px] font-semibold">
            Edit / delete any client
          </h2>
          <p className="mb-3 text-[12px] text-[var(--c-ink-3)]">
            Password re-confirm required. Soft-delete hides the client from
            desks; edit changes name, status, or brand origin.
          </p>
          <SettingsForms mode="edit" parties={sampleParties} />
        </CCard>
      </div>

      <CCard className="border-[var(--c-bad)]/30 ring-[var(--c-bad)]/20">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-[13px] font-semibold text-[var(--c-bad)]">
            Danger zone — clear client data
          </h2>
          <CBadge tone="bad">Password required</CBadge>
        </div>
        <p className="mb-4 text-[12px] text-[var(--c-ink-2)]">
          Irreversible bulk cleanup. Type the confirmation phrase and re-enter
          your login password. Prefer clearing scale/mock seeds before a full
          wipe.
        </p>
        <SettingsForms mode="clear" parties={[]} />
      </CCard>
    </div>
  );
}
