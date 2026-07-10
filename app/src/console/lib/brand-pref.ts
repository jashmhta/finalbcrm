/**
 * Pure helpers for the pre-auth Capital vs Bonds brand preference cookie.
 * Cookie name is shared by login UI + desk shell.
 */

export const CONSOLE_BRAND_COOKIE = "bc_console_brand";

export type ConsoleBrandPref = "binarycapital" | "binarybonds";

export function parseBrandPref(
  raw: string | null | undefined,
): ConsoleBrandPref | null {
  if (raw === "binarycapital" || raw === "binarybonds") return raw;
  return null;
}

export function brandPrefCookieHeader(brand: ConsoleBrandPref): string {
  // 180 days; path=/ so login + desk share it.
  const maxAge = 60 * 60 * 24 * 180;
  return `${CONSOLE_BRAND_COOKIE}=${brand}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}
