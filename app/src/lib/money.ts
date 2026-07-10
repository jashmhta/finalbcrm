// Canonical money helpers for Binary CRM.
//
// Convention across the product:
//   • Domain inputs on deal/lead/matching UIs are in ₹ crores (Cr).
//   • Internal absolute amounts (limits, CTR, bond face when in rupees) are INR.
//   • 1 crore = 10_000_000 INR.
//
// Prefer these helpers over ad-hoc multiplies so portal/reports/matching stay
// consistent after the upcoming UI redesign.

/** One crore in Indian rupees. */
export const INR_PER_CRORE = 10_000_000;

/** Convert ₹ crores → absolute INR. */
export function croreToInr(crores: number): number {
  if (!Number.isFinite(crores)) return NaN;
  return crores * INR_PER_CRORE;
}

/** Convert absolute INR → ₹ crores. */
export function inrToCrore(inr: number): number {
  if (!Number.isFinite(inr)) return NaN;
  return inr / INR_PER_CRORE;
}

/** Parse a numeric that may arrive as string (Drizzle numeric columns). */
export function asNumber(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Format absolute INR for display without UI coupling.
 * Returns a plain string (no React). UI can wrap with brand Money later.
 */
export function formatInrPlain(
  inr: number,
  opts: { compact?: boolean; maximumFractionDigits?: number } = {},
): string {
  if (!Number.isFinite(inr)) return "—";
  if (opts.compact) {
    const abs = Math.abs(inr);
    if (abs >= INR_PER_CRORE) {
      const cr = inr / INR_PER_CRORE;
      return `₹${cr.toLocaleString("en-IN", {
        maximumFractionDigits: opts.maximumFractionDigits ?? 2,
      })} Cr`;
    }
    if (abs >= 100_000) {
      const lakh = inr / 100_000;
      return `₹${lakh.toLocaleString("en-IN", {
        maximumFractionDigits: opts.maximumFractionDigits ?? 2,
      })} L`;
    }
  }
  return `₹${inr.toLocaleString("en-IN", {
    maximumFractionDigits: opts.maximumFractionDigits ?? 0,
  })}`;
}

/** Format crore amount as `₹X.XX Cr`. */
export function formatCrorePlain(
  crores: number,
  maximumFractionDigits = 2,
): string {
  if (!Number.isFinite(crores)) return "—";
  return `₹${crores.toLocaleString("en-IN", { maximumFractionDigits })} Cr`;
}
