// Root entry → dual console desk (brand-first product surface).
// Legacy command center remains under individual routes (/parties, /deals, …).
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function RootPage() {
  redirect("/console");
}
