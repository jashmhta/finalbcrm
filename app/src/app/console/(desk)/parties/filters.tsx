import {
  INDUSTRY_SECTORS,
  INDUSTRY_SECTOR_LABELS,
  INVESTOR_TYPES,
  INVESTOR_TYPE_LABELS,
  PORTFOLIO_SIZE_BANDS,
  PORTFOLIO_SIZE_LABELS,
  RATING_AGENCIES,
  RATING_AGENCY_LABELS,
  RATING_VALUES,
  RISK_APPETITES,
  RISK_APPETITE_LABELS,
  TURNOVER_BANDS,
  TURNOVER_BAND_LABELS,
} from "@/features/parties/segmentation";

export type PartyFilterState = {
  q?: string;
  turnover?: string;
  sector?: string;
  rating?: string;
  agency?: string;
  ratingYear?: string;
  investorType?: string;
  portfolioSize?: string;
  riskAppetite?: string;
  highYield?: string;
  type?: string;
};

const selectCls =
  "h-9 w-full min-w-0 rounded-[var(--c-radius)] bg-[var(--c-surface)] px-2 text-[12px] ring-1 ring-[var(--c-line-strong)]";

export function PartyFiltersForm({
  filters,
  book = "issuer",
}: {
  filters: PartyFilterState;
  /** issuer = Capital company book; investor = Bonds investor book */
  book?: "issuer" | "investor" | "all";
}) {
  const yearNow = new Date().getFullYear();
  const years = Array.from({ length: 12 }, (_, i) => yearNow - i);

  return (
    <form
      method="get"
      action="/console/parties"
      className="mb-4 space-y-2 rounded-[var(--c-radius-lg)] bg-[var(--c-surface)] p-3 ring-1 ring-[var(--c-line)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] font-semibold text-[var(--c-ink)]">
          Filters
          <span className="ml-2 font-normal text-[var(--c-ink-3)]">
            CEO book · RBAC already scopes to your assigned data
          </span>
        </p>
        <div className="flex gap-2">
          <a
            href="/console/parties"
            className="h-9 rounded-[var(--c-radius-pill)] px-3 text-[12px] font-medium text-[var(--c-ink-2)] ring-1 ring-[var(--c-line)]"
          >
            Clear
          </a>
          <button
            type="submit"
            className="h-9 rounded-[var(--c-radius-pill)] bg-[var(--c-accent)] px-4 text-[12px] font-medium text-[var(--c-on-accent)]"
          >
            Apply
          </button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex min-w-0 flex-col gap-1 text-[11px] font-medium text-[var(--c-ink-2)]">
          Search
          <input
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Legal name…"
            className={selectCls}
          />
        </label>

        {(book === "issuer" || book === "all") && (
          <>
            <label className="flex min-w-0 flex-col gap-1 text-[11px] font-medium text-[var(--c-ink-2)]">
              Turnover (₹ Cr)
              <select
                name="turnover"
                defaultValue={filters.turnover ?? ""}
                className={selectCls}
              >
                <option value="">Any</option>
                {TURNOVER_BANDS.map((b) => (
                  <option key={b} value={b}>
                    {TURNOVER_BAND_LABELS[b]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-[11px] font-medium text-[var(--c-ink-2)]">
              Industry sector
              <select
                name="sector"
                defaultValue={filters.sector ?? ""}
                className={selectCls}
              >
                <option value="">Any</option>
                {INDUSTRY_SECTORS.map((s) => (
                  <option key={s} value={s}>
                    {INDUSTRY_SECTOR_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        <label className="flex min-w-0 flex-col gap-1 text-[11px] font-medium text-[var(--c-ink-2)]">
          Rating
          <select
            name="rating"
            defaultValue={filters.rating ?? ""}
            className={selectCls}
          >
            <option value="">Any / unrated</option>
            {RATING_VALUES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-[11px] font-medium text-[var(--c-ink-2)]">
          Rating agency
          <select
            name="agency"
            defaultValue={filters.agency ?? ""}
            className={selectCls}
          >
            <option value="">Any</option>
            {RATING_AGENCIES.map((a) => (
              <option key={a} value={a}>
                {RATING_AGENCY_LABELS[a] ?? a}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-[11px] font-medium text-[var(--c-ink-2)]">
          Rating year
          <select
            name="ratingYear"
            defaultValue={filters.ratingYear ?? ""}
            className={selectCls}
          >
            <option value="">Any</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>

        {(book === "investor" || book === "all") && (
          <>
            <label className="flex min-w-0 flex-col gap-1 text-[11px] font-medium text-[var(--c-ink-2)]">
              Investor type
              <select
                name="investorType"
                defaultValue={filters.investorType ?? ""}
                className={selectCls}
              >
                <option value="">Any</option>
                {INVESTOR_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {INVESTOR_TYPE_LABELS[t] ?? t}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-[11px] font-medium text-[var(--c-ink-2)]">
              Portfolio size
              <select
                name="portfolioSize"
                defaultValue={filters.portfolioSize ?? ""}
                className={selectCls}
              >
                <option value="">Any</option>
                {PORTFOLIO_SIZE_BANDS.map((b) => (
                  <option key={b} value={b}>
                    {PORTFOLIO_SIZE_LABELS[b]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-[11px] font-medium text-[var(--c-ink-2)]">
              Risk appetite
              <select
                name="riskAppetite"
                defaultValue={filters.riskAppetite ?? ""}
                className={selectCls}
              >
                <option value="">Any</option>
                {RISK_APPETITES.map((r) => (
                  <option key={r} value={r}>
                    {RISK_APPETITE_LABELS[r]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-[11px] font-medium text-[var(--c-ink-2)]">
              High-yield appetite
              <select
                name="highYield"
                defaultValue={filters.highYield ?? ""}
                className={selectCls}
              >
                <option value="">Any</option>
                <option value="1">Yes</option>
                <option value="0">No</option>
              </select>
            </label>
          </>
        )}

        <label className="flex min-w-0 flex-col gap-1 text-[11px] font-medium text-[var(--c-ink-2)]">
          Party type
          <select
            name="type"
            defaultValue={filters.type ?? ""}
            className={selectCls}
          >
            <option value="">Any</option>
            <option value="issuer">Issuer</option>
            <option value="investor">Investor</option>
            <option value="both">Both</option>
          </select>
        </label>
      </div>
    </form>
  );
}
