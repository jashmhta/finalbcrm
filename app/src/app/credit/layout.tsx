import { redirect } from "next/navigation";

import { requireUser } from "@/lib/rbac";
import { canAccessCreditModule } from "@/lib/org";

/**
 * Credit analysis is inactive for general employees (CEO note).
 * Super admins, admins, credit_analyst, and director retain access.
 * Set CREDIT_ANALYSIS_ACTIVE=true to open to all staff.
 */
export default async function CreditLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  if (!canAccessCreditModule(user.roles)) {
    redirect("/");
  }
  return children;
}
