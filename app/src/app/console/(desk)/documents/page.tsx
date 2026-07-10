import { requireUser, can } from "@/lib/rbac";
import { listDocuments } from "@/features/documents/queries";
import { CPageHeader } from "@/console/patterns/page-header";
import { CCard } from "@/console/primitives/card";
import { CBadge } from "@/console/primitives/badge";
import { CEmpty } from "@/console/primitives/empty";
import { NewDocumentForm } from "./new-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Documents" };

export default async function ConsoleDocumentsPage() {
  const user = await requireUser();
  if (!can(user, "read", "document") && !can(user, "create", "document")) {
    return (
      <CEmpty
        title="No document access"
        body="You need document:read."
        actionLabel="Home"
        actionHref="/console"
      />
    );
  }

  const { rows, total } = await listDocuments({ user, page: 1, pageSize: 40 });

  return (
    <div>
      <CPageHeader
        eyebrow="Workspace"
        title="Documents"
        description={`${total} files in scope (metadata + secure store ref).`}
      />
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-2 lg:col-span-2">
          {rows.length === 0 ? (
            <CEmpty title="No documents" body="Upload a KYC pack or mandate file." />
          ) : (
            rows.map((d) => (
              <CCard key={d.documentId} className="min-w-0 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <CBadge tone="neutral">{d.documentType ?? "file"}</CBadge>
                  {d.isMnpi ? <CBadge tone="bad">MNPI</CBadge> : null}
                  {d.isConfidential ? <CBadge tone="warn">Confidential</CBadge> : null}
                </div>
                <p className="mt-1 break-all text-[13px] font-semibold">{d.fileName}</p>
                <p className="text-[12px] text-[var(--c-ink-3)]">
                  {d.partyName ?? "—"}
                  {d.dealCode ? ` · ${d.dealCode}` : ""}
                  {d.sizeBytes != null ? ` · ${Math.round(d.sizeBytes / 1024)} KB` : ""}
                </p>
              </CCard>
            ))
          )}
        </div>
        {can(user, "create", "document") ? (
          <CCard className="min-w-0">
            <h2 className="mb-3 text-[13px] font-semibold">Upload</h2>
            <NewDocumentForm />
          </CCard>
        ) : null}
      </div>
    </div>
  );
}
