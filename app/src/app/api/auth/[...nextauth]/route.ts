// Auth.js v5 route handler - App Router convention. `handlers` is exported by
// NextAuth() in @/lib/auth. The catch-all `[...nextauth]` segment serves all
// Auth.js endpoints (/api/auth/signin, /callback, /session, /signout, …).
// Route Handlers are dynamic by default (they touch cookies/headers), so no
// `force-dynamic` is needed and `next build` won't prerender this route.

import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
export const runtime = "nodejs";
