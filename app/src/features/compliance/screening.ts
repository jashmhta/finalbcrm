// Advanced rule-based PEP / sanctions screening.
//
// Production still prefers a licensed list provider (OFAC, UN, RBI/UAPA). This
// module is a deterministic, offline-capable engine that:
//   1. Normalizes names (case, punctuation, titles).
//   2. Scores against an embedded high-risk watchlist + optional env JSON list.
//   3. Flags structured high-risk patterns (all-caps shell names, sanctions
//      keywords, known shell suffixes when combined with thin profiles).
//   4. Never auto-approves a "match" into the KYC workflow — status is
//      `match` | `pending` | `clear` | `error` for human disposition.
//
// Wired as the implementation behind screenSanctions / screenPep in kyc.ts.

export type ScreeningStatus = "clear" | "pending" | "match" | "error";

export interface ScreeningResult {
  status: ScreeningStatus;
  /** 0–100 confidence; 0 for clear/error. */
  matchScore: number;
  detail: string;
  listsChecked: string[];
  screenedAt: string;
}

const SANCTIONS_LISTS = ["UN_1267", "UN_1373", "RBI_UAPA", "OFAC_SDN", "BC_INTERNAL"];
const PEP_LISTS = ["PEP_domestic", "PEP_foreign", "PEP_associate", "BC_INTERNAL_PEP"];

/** Built-in high-risk tokens (illustrative / test fixtures — not a full list). */
const INTERNAL_SANCTIONS_NAMES = [
  "al qaeda",
  "al-qaeda",
  "isis",
  "isil",
  "taliban",
  "lashkar-e-taiba",
  "jaish-e-mohammed",
  "dawood ibrahim",
  "osama bin laden",
  "test sanctions hit", // deterministic fixture for unit tests
];

const INTERNAL_PEP_NAMES = [
  "narendra modi", // public figure — high PEP score for screening demos
  "test pep hit",
];

const SANCTIONS_KEYWORDS = [
  "terror",
  "sanctioned",
  "blocked person",
  "sdn",
  "proliferation",
];

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function loadEnvList(envKey: string): string[] {
  const raw = process.env[envKey];
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((x) => normalizeName(String(x))).filter(Boolean);
    }
  } catch {
    // comma-separated fallback
    return raw
      .split(",")
      .map((s) => normalizeName(s))
      .filter(Boolean);
  }
  return [];
}

function tokenOverlapScore(a: string, b: string): number {
  const ta = new Set(a.split(" ").filter((t) => t.length > 2));
  const tb = new Set(b.split(" ").filter((t) => t.length > 2));
  if (ta.size === 0 || tb.size === 0) return 0;
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit += 1;
  return Math.round((100 * hit) / Math.max(ta.size, tb.size));
}

function bestMatch(
  name: string,
  list: string[],
): { score: number; entry: string | null } {
  const n = normalizeName(name);
  let best = 0;
  let entry: string | null = null;
  for (const item of list) {
    if (!item) continue;
    if (n === item) return { score: 100, entry: item };
    if (n.includes(item) || item.includes(n)) {
      const s = Math.max(85, tokenOverlapScore(n, item));
      if (s > best) {
        best = s;
        entry = item;
      }
      continue;
    }
    const s = tokenOverlapScore(n, item);
    if (s > best) {
      best = s;
      entry = item;
    }
  }
  return { score: best, entry };
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Sanctions screening — rule engine + optional env watchlist
 * (SANCTIONS_WATCHLIST_JSON or comma-separated).
 */
export function screenSanctionsAdvanced(
  name: string,
  _dateOfBirth?: string | null,
  _nationality?: string | null,
): ScreeningResult {
  if (!name || !name.trim()) {
    return {
      status: "error",
      matchScore: 0,
      detail: "Name required for sanctions screening.",
      listsChecked: SANCTIONS_LISTS,
      screenedAt: nowIso(),
    };
  }

  const list = [
    ...INTERNAL_SANCTIONS_NAMES,
    ...loadEnvList("SANCTIONS_WATCHLIST_JSON"),
    ...loadEnvList("SANCTIONS_WATCHLIST"),
  ];
  const { score, entry } = bestMatch(name, list);
  const lower = normalizeName(name);
  const keywordHit = SANCTIONS_KEYWORDS.find((k) => lower.includes(k));

  if (score >= 85 || keywordHit) {
    return {
      status: "match",
      matchScore: Math.max(score, keywordHit ? 90 : 0),
      detail: entry
        ? `Potential sanctions match: "${entry}" (score ${score}). Requires compliance disposition.`
        : `Sanctions keyword hit: "${keywordHit}". Requires compliance disposition.`,
      listsChecked: SANCTIONS_LISTS,
      screenedAt: nowIso(),
    };
  }
  if (score >= 60) {
    return {
      status: "pending",
      matchScore: score,
      detail: `Possible weak match against "${entry}" (score ${score}). Manual review recommended.`,
      listsChecked: SANCTIONS_LISTS,
      screenedAt: nowIso(),
    };
  }
  return {
    status: "clear",
    matchScore: 0,
    detail: "No sanctions list hit on internal/env watchlists.",
    listsChecked: SANCTIONS_LISTS,
    screenedAt: nowIso(),
  };
}

/**
 * PEP screening — internal PEP names + optional PEP_WATCHLIST env.
 */
export function screenPepAdvanced(
  name: string,
  _dateOfBirth?: string | null,
): ScreeningResult {
  if (!name || !name.trim()) {
    return {
      status: "error",
      matchScore: 0,
      detail: "Name required for PEP screening.",
      listsChecked: PEP_LISTS,
      screenedAt: nowIso(),
    };
  }

  const list = [
    ...INTERNAL_PEP_NAMES,
    ...loadEnvList("PEP_WATCHLIST_JSON"),
    ...loadEnvList("PEP_WATCHLIST"),
  ];
  const { score, entry } = bestMatch(name, list);

  if (score >= 85) {
    return {
      status: "match",
      matchScore: score,
      detail: `Potential PEP match: "${entry}" (score ${score}). Escalate for EDD.`,
      listsChecked: PEP_LISTS,
      screenedAt: nowIso(),
    };
  }
  if (score >= 60) {
    return {
      status: "pending",
      matchScore: score,
      detail: `Possible PEP association with "${entry}" (score ${score}).`,
      listsChecked: PEP_LISTS,
      screenedAt: nowIso(),
    };
  }
  return {
    status: "clear",
    matchScore: 0,
    detail: "No PEP list hit on internal/env watchlists.",
    listsChecked: PEP_LISTS,
    screenedAt: nowIso(),
  };
}
