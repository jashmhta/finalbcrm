// Legacy /login → console brand-first gate so public users never hit the old form.
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const sp = await searchParams;
  const raw = sp.callbackUrl;
  // Prefer staying under console after auth.
  let dest = "/console/login";
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) {
    const cb = raw.startsWith("/console") ? raw : `/console${raw === "/" ? "" : raw}`;
    dest = `/console/login?callbackUrl=${encodeURIComponent(cb.startsWith("/console") ? cb : "/console")}`;
  }
  redirect(dest);
}
