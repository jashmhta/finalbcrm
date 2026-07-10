import Link from "next/link";
import { requireUser, can } from "@/lib/rbac";
import { CPageHeader } from "@/console/patterns/page-header";
import { CEmpty } from "@/console/primitives/empty";
import { NewLeadForm } from "./form";

export const dynamic = "force-dynamic";
export const metadata = { title: "New lead" };

export default async function ConsoleNewLeadPage() {
  const user = await requireUser();
  if (!can(user, "create", "lead") && !can(user, "create", "party")) {
    return (
      <CEmpty
        title="Cannot create leads"
        body="You need lead:create or party:create."
        actionLabel="Leads"
        actionHref="/console/leads"
      />
    );
  }

  return (
    <div>
      <CPageHeader
        title="New lead"
        description="Capture a prospect - stored on the party master with lead_meta."
        actions={
          <Link
            href="/console/leads"
            className="inline-flex h-10 items-center rounded-[var(--c-radius-pill)] px-4 text-[13px] ring-1 ring-[var(--c-line-strong)]"
          >
            Cancel
          </Link>
        }
      />
      <NewLeadForm />
    </div>
  );
}
