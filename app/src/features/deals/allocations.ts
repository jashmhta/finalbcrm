// Allocation-event semantics for book-built / auction mandates.
//
// `allocation_event` is an IMMUTABLE append-only event-sourced table
// (src/db/schema/deals.ts §2.11). The current allocation state per
// (deal_id, party_id) is derived by replaying these events. This module
// encodes the business-logic rules the mutation layer must enforce BEFORE
// appending an event:
//   - which deal types run an allocation book at all (bond underwriting, HY,
//     private placement, G-Sec auction, ECM book-built offers) vs which do not
//     (advisory / valuation / portfolio / secondary mandates);
//   - the canonical forward event flow for a single investor's allocation:
//     indication → order → revised_order → allocated →
//     oversubscribed_adjusted → settled, with `withdrawn` as a terminal
//     cancel that may be appended from any pre-allocation state.
//
// Verified against the allocation_event types specified for this audit
// (indication, order, revised_order, allocated, oversubscribed_adjusted,
// settled) and scrape/BUSINESS_CONTEXT.md §3.2 (Binary Bonds underwriting
// 6-step process: mandate → DD/structuring → rating/docs → marketing →
// pricing & allocation → issuance & settlement).
//
// Pure helpers - no DB access. The deal-type allocation flag is sourced from
// catalog.ts so the two modules cannot disagree.

import type { AllocEventType, DealType } from "./catalog";
import { isAllocationDealType } from "./catalog";

/**
 * Canonical forward flow for one investor's allocation (book-building). The
 * `withdrawn` terminal cancel is modeled separately (it is not a forward
 * step).
 */
export const ALLOC_EVENT_FLOW: readonly AllocEventType[] = [
  "indication",
  "order",
  "revised_order",
  "allocated",
  "oversubscribed_adjusted",
  "settled",
];

/** Terminal allocation events (no further events may follow). */
export const ALLOC_EVENT_TERMINAL: readonly AllocEventType[] = [
  "settled",
  "withdrawn",
];

/** Pre-allocation states from which an investor may withdraw. */
export const ALLOC_EVENT_WITHDRAWABLE: readonly AllocEventType[] = [
  "indication",
  "order",
  "revised_order",
];

/** Index of an event in the forward flow; -1 for `withdrawn` (off-flow). */
export function allocEventIndex(
  ev: AllocEventType | string | null | undefined,
): number {
  if (!ev) return -1;
  return ALLOC_EVENT_FLOW.indexOf(ev as AllocEventType);
}

/** True for terminal allocation events (settled / withdrawn). */
export function isAllocEventTerminal(
  ev: AllocEventType | string | null | undefined,
): boolean {
  if (!ev) return false;
  return (ALLOC_EVENT_TERMINAL as readonly string[]).includes(ev);
}

/**
 * Whether an allocation-event transition is business-logic valid for a single
 * investor's allocation lifecycle.
 *
 * Rules:
 *  - `from == null` (no prior event): the first event must be `indication` or,
 *    for a directly-placed firm order, `order`. (`allocated`/`settled` cannot
 *    be the first event - there must be a prior indication/order.)
 *  - `from === "indication"`: may go to `order` or `withdrawn`.
 *  - `from === "order"`: may go to `revised_order`, `allocated`, or `withdrawn`.
 *  - `from === "revised_order"`: may go to `revised_order` (further revision),
 *    `allocated`, or `withdrawn`.
 *  - `from === "allocated"`: may go to `oversubscribed_adjusted` or `settled`.
 *  - `from === "oversubscribed_adjusted"`: may go to `settled`.
 *  - `from === "settled"` / `from === "withdrawn"`: terminal - no further events.
 *  - `to === from` is a no-op (allowed only for `revised_order` → itself; other
 *    no-ops are rejected since re-appending the same non-revision event is not
 *    meaningful).
 */
export function canTransitionAllocEvent(
  from: AllocEventType | string | null | undefined,
  to: AllocEventType | string | null | undefined,
): boolean {
  if (!to) return false;
  const t = to as AllocEventType;

  if (!from) {
    // First event in the lifecycle.
    return t === "indication" || t === "order";
  }

  const f = from as AllocEventType;
  if (f === t) {
    // Only a revised order may re-append as the same event type (a further
    // revision). Other self-loops are not meaningful.
    return f === "revised_order";
  }

  switch (f) {
    case "indication":
      return t === "order" || t === "withdrawn";
    case "order":
      return t === "revised_order" || t === "allocated" || t === "withdrawn";
    case "revised_order":
      return t === "revised_order" || t === "allocated" || t === "withdrawn";
    case "allocated":
      return t === "oversubscribed_adjusted" || t === "settled";
    case "oversubscribed_adjusted":
      return t === "settled";
    case "settled":
    case "withdrawn":
      return false; // terminal
    default:
      return false;
  }
}

/**
 * Whether a deal type accepts allocation events at all. Bond underwriting, HY,
 * private placement, G-Sec auction, and ECM book-built offers do; pure
 * advisory / valuation / portfolio / secondary mandates do not (they have no
 * investor allocation book).
 */
export function isAllocationDeal(dealType: DealType): boolean {
  return isAllocationDealType(dealType);
}

/**
 * Whether a specific allocation_event type is valid for a deal type. Allocation
 * deals accept the full event set; non-allocation deals accept none (an
 * allocation event on, e.g., an M&A or valuation mandate is a logic error).
 */
export function isValidAllocEventForDealType(
  dealType: DealType,
  eventType: AllocEventType | string | null | undefined,
): boolean {
  if (!eventType) return false;
  if (!isAllocationDeal(dealType)) return false;
  return true;
}
