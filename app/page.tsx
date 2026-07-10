import Link from "next/link";

import { requireUser } from "@/lib/rbac";
import { db } from "@/db";
import { deal, party } from "@/db/schema";
import { count, isNull } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// force-dynamic: this page reads DB counts at request time. Without this,
// `next build` would try to execute the queries at build time (no DATABASE_URL)
// and fail.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  // requireUser redirects to /login when unauthenticated (also enforced by the
  // proxy, but this is the authoritative server-side check).
  const user = await requireUser();

  const [[partyCount], [dealCount]] = await Promise.all([
    db
      .select({ n: count() })
      .from(party)
      .where(isNull(party.deletedAt)),
    db.select({ n: count() }).from(deal).where(isNull(deal.deletedAt)),
  ]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back, {user.name ?? user.email}. Roles:{" "}
          {user.roles.length ? user.roles.join(", ") : "none assigned"}.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/parties" className="contents">
          <Card>
            <CardHeader>
              <CardDescription>Parties</CardDescription>
              <CardTitle className="text-2xl">{partyCount?.n ?? 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Issuers, investors, intermediaries
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/deals" className="contents">
          <Card>
            <CardHeader>
              <CardDescription>Deals</CardDescription>
              <CardTitle className="text-2xl">{dealCount?.n ?? 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Mandates across IB + DCM
              </p>
            </CardContent>
          </Card>
        </Link>
        <Card>
          <CardHeader>
            <CardDescription>Your wall</CardDescription>
            <CardTitle className="text-2xl">
              {user.wall.length ? user.wall.length : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {user.wall.length
                ? user.wall.join(", ")
                : "No barrier compartments assigned"}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
