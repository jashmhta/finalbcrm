// Shared environment + HTTP plumbing for integration adapters.
//
// This module is the single source of truth for:
//   • the USE_MOCK_INTEGRATIONS toggle (default: true in dev, false in prod
//     when credentials are present),
//   • per-adapter credential discovery against the keys already declared in
//     `.env.example` (plus a small set of additional keys documented in the
//     adapter headers below - they are read via `process.env` so wiring is a
//     credential-away),
//   • a typed HTTP client with timeout + exponential-backoff retry + structured
//     error handling, used by every real adapter client,
//   • a typed `IntegrationError` that carries enough metadata for the Server
//     Action layer to map it to a stable `AdapterResult.error`.
//
// Server-only: adapters are invoked from Server Actions / force-dynamic server
// components only. No "use client" boundary crosses this module.

export type AdapterId =
  | "accountAggregator"
  | "kra"
  | "ckyc"
  | "mca"
  | "gstinPan"
  | "bseNse"
  | "ccil"
  | "demat"
  | "ratingFeed"
  | "fiuInd"
  | "emailCalendar"
  | "whatsapp";

/** Structured error codes every adapter + the HTTP client can emit. */
export type IntegrationErrorCode =
  | "not_configured"
  | "timeout"
  | "network"
  | "auth"
  | "rate_limit"
  | "bad_response"
  | "http"
  | "validation"
  | "upstream";

/**
 * Structured error thrown by real adapter clients. Carries enough metadata for
 * the adapter's `runReal` wrapper to produce a stable `AdapterResult` without
 * leaking the raw upstream message.
 */
export class IntegrationError extends Error {
  readonly adapter: string;
  readonly code: IntegrationErrorCode;
  readonly httpStatus?: number;
  readonly retryable: boolean;
  override readonly cause?: unknown;

  constructor(opts: {
    adapter: string;
    code: IntegrationErrorCode;
    message: string;
    httpStatus?: number;
    retryable?: boolean;
    cause?: unknown;
  }) {
    super(opts.message);
    this.name = "IntegrationError";
    this.adapter = opts.adapter;
    this.code = opts.code;
    this.httpStatus = opts.httpStatus;
    this.retryable = opts.retryable ?? false;
    this.cause = opts.cause;
  }

  /** One-line safe summary for `AdapterResult.error`. */
  toSummary(): string {
    const parts: string[] = [this.code];
    if (this.httpStatus) parts.push(`HTTP ${this.httpStatus}`);
    return `${parts.join(" ")}: ${this.message}`;
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   Env access. Wrapped in functions so tests / build-time evaluation stay
   deterministic and so `process.env` access is centralized here rather than
   scattered across adapters.
   ────────────────────────────────────────────────────────────────────────── */

function envValue(key: string): string | undefined {
  // `process.env` access in Next.js server runtime. Trimmed; empty string is
  // treated as "not set" for credential-presence checks.
  const v = process.env[key];
  return v && v.trim().length > 0 ? v.trim() : undefined;
}

/** True when a non-empty value is set for every key in `keys`. */
export function envKeysPresent(keys: string[]): boolean {
  if (keys.length === 0) return false;
  return keys.every((k) => envValue(k) !== undefined);
}

/** Read a credential or throw a structured `not_configured` error. */
export function requireEnv(key: string, adapter: string): string {
  const v = envValue(key);
  if (!v) {
    throw new IntegrationError({
      adapter,
      code: "not_configured",
      message: `Missing required env var ${key}`,
      retryable: false,
    });
  }
  return v;
}

/** Read an optional env var (returns undefined when unset/empty). */
export function optionalEnv(key: string): string | undefined {
  return envValue(key);
}

/**
 * Resolve the mock-mode flag for an adapter.
 *
 * Precedence:
 *   1. `USE_MOCK_INTEGRATIONS` explicitly "true"|"false" → honor it globally.
 *   2. Otherwise: default TRUE in development, FALSE in production (so prod
 *      attempts the real client when credentials are present, and falls back
 *      to mock when they are not - see `resolveAdapterStatus`).
 *
 * Per-adapter overrides via `USE_MOCK_<ADAPTER_ID>` (e.g.
 * `USE_MOCK_ACCOUNT_AGGREGATOR`) are honored when set, so a single adapter can
 * be pinned to mock while the rest go live.
 */
export function isMockMode(adapter: AdapterId): boolean {
  const perAdapterKey = `USE_MOCK_${adapter.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase()}`;
  const perAdapter = envValue(perAdapterKey);
  if (perAdapter === "true") return true;
  if (perAdapter === "false") return false;

  const global = envValue("USE_MOCK_INTEGRATIONS");
  if (global === "true") return true;
  if (global === "false") return false;

  return process.env.NODE_ENV !== "production";
}

/* ──────────────────────────────────────────────────────────────────────────
   Per-adapter credential declarations.
   ────────────────────────────────────────────────────────────────────────── */

export interface AdapterCredentialSpec {
  /** Env var names the real client reads. Listed in the UI as "required". */
  keys: string[];
  /**
   * Predicate for "credentials are present enough to attempt a real call".
   * Defaults to "every key in `keys` is set". Override for mode/provider-
   * dependent adapters (e.g. gstinPan needs GSTIN_API_KEY OR PAN_API_KEY).
   */
  present?: () => boolean;
}

const all = (keys: string[]) => () => envKeysPresent(keys);
const any = (sets: string[][]) => () => sets.some((s) => envKeysPresent(s));

export const ADAPTER_CREDENTIALS: Record<AdapterId, AdapterCredentialSpec> = {
  accountAggregator: {
    keys: ["AA_CLIENT_ID", "AA_CLIENT_SECRET", "AA_ENV"],
    present: all(["AA_CLIENT_ID", "AA_CLIENT_SECRET"]),
  },
  kra: {
    keys: ["KRA_API_USER", "KRA_API_KEY"],
    present: all(["KRA_API_USER", "KRA_API_KEY"]),
  },
  ckyc: {
    // CKYCRR 2.0 is reached via CERSAI; .env.example groups KRA/CKYC creds.
    keys: ["KRA_API_USER", "KRA_API_KEY"],
    present: all(["KRA_API_USER", "KRA_API_KEY"]),
  },
  mca: {
    keys: ["MCA_API_KEY"],
    present: all(["MCA_API_KEY"]),
  },
  gstinPan: {
    keys: ["GSTIN_API_KEY", "PAN_API_KEY"],
    present: any([["GSTIN_API_KEY"], ["PAN_API_KEY"]]),
  },
  bseNse: {
    keys: ["BSE_API_KEY", "NSE_API_KEY"],
    present: any([["BSE_API_KEY"], ["NSE_API_KEY"]]),
  },
  ccil: {
    // F-TRAC is a member-portal workflow; creds documented as a new env pair.
    keys: ["CCIL_FTRAC_USER", "CCIL_FTRAC_PASSWORD"],
    present: all(["CCIL_FTRAC_USER", "CCIL_FTRAC_PASSWORD"]),
  },
  demat: {
    keys: ["DP_API_USER", "DP_API_KEY"],
    present: all(["DP_API_USER", "DP_API_KEY"]),
  },
  ratingFeed: {
    keys: ["RATING_FEED_API_KEY"],
    present: all(["RATING_FEED_API_KEY"]),
  },
  fiuInd: {
    // FINGate 2.0 portal creds (reporting-entity login) - new env pair.
    keys: ["FIU_IND_FINGATE_USER", "FIU_IND_FINGATE_PASSWORD"],
    present: all(["FIU_IND_FINGATE_USER", "FIU_IND_FINGATE_PASSWORD"]),
  },
  emailCalendar: {
    keys: [
      "GRAPH_CLIENT_ID",
      "GRAPH_CLIENT_SECRET",
      "GOOGLE_WORKSPACE_CLIENT_ID",
      "GOOGLE_WORKSPACE_CLIENT_SECRET",
    ],
    present: any([
      ["GRAPH_CLIENT_ID", "GRAPH_CLIENT_SECRET"],
      ["GOOGLE_WORKSPACE_CLIENT_ID", "GOOGLE_WORKSPACE_CLIENT_SECRET"],
    ]),
  },
  whatsapp: {
    // Meta Cloud API - new env vars (token + phone number id + optional BSP).
    keys: ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"],
    present: all(["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"]),
  },
};

/** True when the adapter has enough credentials to attempt a real call. */
export function credentialsPresent(adapter: AdapterId): boolean {
  const spec = ADAPTER_CREDENTIALS[adapter];
  return (spec.present ?? all(spec.keys))();
}

/** Env keys declared for an adapter (for UI/registry display). */
export function adapterEnvKeys(adapter: AdapterId): string[] {
  return ADAPTER_CREDENTIALS[adapter].keys;
}

/**
 * Resolve the public status of an adapter from env.
 *   • mock mode forced (dev default or USE_MOCK=true) → "mock"
 *   • real mode attempted + credentials present → "ready"
 *   • real mode attempted + credentials missing → "mock" (credential-away)
 */
export function resolveAdapterStatus(adapter: AdapterId): "mock" | "ready" {
  if (isMockMode(adapter)) return "mock";
  return credentialsPresent(adapter) ? "ready" : "mock";
}

/* ──────────────────────────────────────────────────────────────────────────
   HTTP client - timeout + retry (exponential backoff + jitter) + structured
   error handling. Used by every real adapter client; never invoked in mock
   mode.
   ────────────────────────────────────────────────────────────────────────── */

export interface HttpClientOptions {
  /** Base URL (no trailing slash). */
  baseUrl: string;
  /** Adapter id for error attribution. */
  adapter: AdapterId;
  /** Per-request default headers (auth, content-type, etc.). */
  defaultHeaders?: Record<string, string>;
  /** Request timeout in ms (default 15_000). */
  timeoutMs?: number;
  /** Max retries on retryable errors (default 3). */
  maxRetries?: number;
}

export interface HttpRequestConfig {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxRetries?: number;
  /** Optional external abort signal (composed with the timeout signal). */
  signal?: AbortSignal;
  /** Parse mode: JSON (default) or text. */
  parse?: "json" | "text";
}

function buildUrl(baseUrl: string, path: string, query?: HttpRequestConfig["query"]): string {
  const base = baseUrl.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!query) return `${base}${p}`;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null) qs.append(k, String(v));
  }
  const s = qs.toString();
  return s ? `${base}${p}?${s}` : `${base}${p}`;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new IntegrationError({ adapter: "", code: "timeout", message: "Aborted during backoff", retryable: false }));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly adapter: AdapterId;
  private readonly defaultHeaders: Record<string, string>;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(opts: HttpClientOptions) {
    this.baseUrl = opts.baseUrl;
    this.adapter = opts.adapter;
    this.defaultHeaders = opts.defaultHeaders ?? {};
    this.timeoutMs = opts.timeoutMs ?? 15_000;
    this.maxRetries = opts.maxRetries ?? 3;
  }

  async request<TResponse = unknown>(cfg: HttpRequestConfig): Promise<TResponse> {
    const maxRetries = cfg.maxRetries ?? this.maxRetries;
    const timeoutMs = cfg.timeoutMs ?? this.timeoutMs;
    const parse = cfg.parse ?? "json";
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...this.defaultHeaders,
      ...(cfg.body ? { "Content-Type": "application/json" } : {}),
      ...cfg.headers,
    };

    let lastErr: IntegrationError | undefined;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      // Compose with an external abort signal if provided.
      if (cfg.signal) {
        if (cfg.signal.aborted) ctrl.abort();
        else cfg.signal.addEventListener("abort", () => ctrl.abort(), { once: true });
      }
      try {
        const url = buildUrl(this.baseUrl, cfg.path, cfg.query);
        const res = await fetch(url, {
          method: cfg.method ?? "GET",
          headers,
          body: cfg.body !== undefined ? JSON.stringify(cfg.body) : undefined,
          signal: ctrl.signal,
          cache: "no-store",
        });
        clearTimeout(timer);

        if (res.status === 401 || res.status === 403) {
          throw new IntegrationError({
            adapter: this.adapter,
            code: "auth",
            httpStatus: res.status,
            message: `Upstream auth failed (${res.status})`,
            retryable: false,
          });
        }
        if (res.status === 429) {
          throw new IntegrationError({
            adapter: this.adapter,
            code: "rate_limit",
            httpStatus: 429,
            message: "Upstream rate limit hit",
            retryable: true,
          });
        }
        if (res.status >= 500) {
          throw new IntegrationError({
            adapter: this.adapter,
            code: "http",
            httpStatus: res.status,
            message: `Upstream server error (${res.status})`,
            retryable: true,
          });
        }
        if (!res.ok) {
          throw new IntegrationError({
            adapter: this.adapter,
            code: "http",
            httpStatus: res.status,
            message: `Upstream client error (${res.status})`,
            retryable: false,
          });
        }

        const text = await res.text();
        if (parse === "text") return text as unknown as TResponse;
        if (!text) return undefined as unknown as TResponse;
        try {
          return JSON.parse(text) as TResponse;
        } catch (e) {
          throw new IntegrationError({
            adapter: this.adapter,
            code: "bad_response",
            message: "Upstream returned a non-JSON body",
            retryable: false,
            cause: e,
          });
        }
      } catch (e) {
        clearTimeout(timer);
        if (e instanceof IntegrationError) {
          lastErr = e;
          if (!e.retryable || attempt >= maxRetries) throw e;
        } else if (e instanceof Error && (e.name === "AbortError" || ctrl.signal.aborted)) {
          lastErr = new IntegrationError({
            adapter: this.adapter,
            code: "timeout",
            message: `Request timed out after ${timeoutMs}ms`,
            retryable: attempt < maxRetries,
            cause: e,
          });
          if (!lastErr.retryable) throw lastErr;
        } else if (e instanceof Error) {
          lastErr = new IntegrationError({
            adapter: this.adapter,
            code: "network",
            message: e.message || "Network error",
            retryable: attempt < maxRetries,
            cause: e,
          });
          if (!lastErr.retryable) throw lastErr;
        } else {
          lastErr = new IntegrationError({
            adapter: this.adapter,
            code: "upstream",
            message: "Unknown upstream error",
            retryable: attempt < maxRetries,
            cause: e,
          });
          if (!lastErr.retryable) throw lastErr;
        }
      }
      // Exponential backoff with full jitter, capped at 2s.
      const base = Math.min(2_000, 250 * 2 ** attempt);
      const backoff = base + Math.random() * 150;
      await sleep(backoff, cfg.signal);
    }
    throw lastErr ?? new IntegrationError({
      adapter: this.adapter,
      code: "upstream",
      message: "Exhausted retries",
      retryable: false,
    });
  }
}

/** Build a bearer-auth header map from a token. */
export function bearerAuth(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/** Build a basic-auth header map. */
export function basicAuth(user: string, secret: string): Record<string, string> {
  return { Authorization: `Basic ${Buffer.from(`${user}:${secret}`).toString("base64")}` };
}
