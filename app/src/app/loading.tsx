import { SkeletonPage } from "@/components/brand/skeleton";

/**
 * Global loading state - the instant-feedback shell.
 *
 * Every route in this CRM is `force-dynamic` (server-rendered on each request
 * against Neon us-east-1), so navigation can take a beat while the query runs.
 * Next.js streams this file from the root Suspense boundary the moment a
 * `<Link>` is clicked - before the server responds - so the user sees a
 * brand-language skeleton (gold-tinted shimmer over double-bezel cards) within
 * a frame, never a blank screen.
 *
 * Route-specific `loading.tsx` files (deals, parties, compliance/kyc) override
 * this with skeletons that mirror their real layout. This root fallback is the
 * catch-all for every other route.
 *
 * Plain CSS shimmer (no Framer Motion) → paints on first frame and honors
 * prefers-reduced-motion. The heading uses real text ("Loading") so screen
 * readers announce the route transition.
 */
export default function Loading() {
  return <SkeletonPage eyebrow="Binary CRM" title="Loading" cards={4} />;
}
