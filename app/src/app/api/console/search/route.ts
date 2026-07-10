import { NextResponse } from "next/server";

import { requireUser } from "@/lib/rbac";
import { globalSearch } from "@/features/search/queries";

export const dynamic = "force-dynamic";

/** JSON search API for command palette / typeahead. */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    if (q.length < 1) {
      return NextResponse.json({ q, hits: [], tookMs: 0, counts: {} });
    }
    const result = await globalSearch(q, user, { limit: 12 });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
