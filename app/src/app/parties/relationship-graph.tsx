"use client";

/**
 * RelationshipGraph - the conceptual object at the heart of the Relationship
 * Explorer. NOT a table of edges: a small vertical node-link that maps the
 * selected party's ownership / control graph as three machined strata -
 * "Controlled by" (parents / beneficial owners, top), the party itself (center,
 * emerald), and "Controls" (subsidiaries / associates, bottom) - linked by
 * hairline connectors with ownership % drawn in Geist Mono on the edges.
 *
 * Two scales:
 *   variant="mini"  - the PreviewPane body. ≤3 nodes per tier, compact
 *                     connectors (a single hairline drop), bounded height.
 *   variant="full"  - the detail-page section. ≤8 nodes per tier, a hairline
 *                     bus + drop connector, larger center node, and an
 *                     "Ultimate parent" caption when a majority owner resolves.
 *
 * Beneficial-owner edges (relationship_type = 'beneficial_owner') carry a gold
 * "BO" micro-tag so compliance ownership reads distinctly from corporate
 * control. The highest-ownership parent ≥ 50% is badged as the ultimate parent.
 *
 * Pure presentational - takes a serializable `relationships` slice (the page
 * owns the data), renders visible on mount (no whileInView gate), and every
 * node links to that party's detail page. Client-only because the nodes use
 * Link + hover micro-interaction; no phosphor import here (the optional center
 * mark is a ReactNode the caller owns).
 */
import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Graph } from "@/components/brand/icons";
import type { PartyPreviewRelationship } from "@/features/parties/queries";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/brand";

export interface RelationshipGraphProps {
  /** The selected party's id + display name - the center node. */
  partyId: string;
  legalName: string;
  /** Optional sub-label under the center name (nature / primary type). */
  centerSub?: React.ReactNode;
  /** Optional mark (a PartyAvatar) rendered in the center node's disc. */
  centerMark?: React.ReactNode;
  /** The party's relationship edges (direction parent = controls otherParty;
   *  direction child = controlled by otherParty). */
  relationships: PartyPreviewRelationship[];
  /** mini = preview pane; full = detail page section. */
  variant?: "mini" | "full";
  className?: string;
}

function ownershipOf(r: PartyPreviewRelationship): number | null {
  if (!r.ownershipPct) return null;
  const n = Number(r.ownershipPct);
  return Number.isFinite(n) ? n : null;
}

function sortByOwnership(rs: PartyPreviewRelationship[]): PartyPreviewRelationship[] {
  return [...rs].sort((a, b) => {
    const oa = ownershipOf(a) ?? -1;
    const ob = ownershipOf(b) ?? -1;
    if (ob !== oa) return ob - oa;
    return a.otherPartyName.localeCompare(b.otherPartyName);
  });
}

export function RelationshipGraph({
  partyId,
  legalName,
  centerSub,
  centerMark,
  relationships,
  variant = "mini",
  className,
}: RelationshipGraphProps) {
  const isFull = variant === "full";
  const maxNodes = isFull ? 8 : 3;

  // "Controlled by" = the selected party is a CHILD of these (parents / owners).
  const parents = sortByOwnership(
    relationships.filter((r) => r.direction === "child"),
  );
  // "Controls" = the selected party is the PARENT of these (subsidiaries).
  const children = sortByOwnership(
    relationships.filter((r) => r.direction === "parent"),
  );

  // Ultimate parent = the majority owner (≥50%); falls back to the largest
  // owner if none cross 50%. Used only for the gold "Ultimate parent" caption.
  const ultimateParent = parents.find((r) => {
    const o = ownershipOf(r);
    return o != null && o >= 50;
  });

  if (relationships.length === 0) {
    return (
      <EmptyState
        icon={<Graph weight="light" />}
        title="No relationships mapped yet."
        hint="Link a parent, subsidiary or beneficial owner to build this party's ownership graph."
        align="center"
        className="py-10"
      />
    );
  }

  const shownParents = parents.slice(0, maxNodes);
  const shownChildren = children.slice(0, maxNodes);
  const extraParents = parents.length - shownParents.length;
  const extraChildren = children.length - shownChildren.length;

  return (
    <div
      data-slot="relationship-graph"
      className={cn("flex flex-col items-center gap-0", className)}
    >
      {shownParents.length > 0 ? (
        <>
          <TierLabel
            label="Controlled by"
            count={parents.length}
            isFull={isFull}
          />
          <TierNodes
            nodes={shownParents}
            extra={extraParents}
            isFull={isFull}
            partyId={partyId}
          />
          <Connector isFull={isFull} />
        </>
      ) : null}

      <CenterNode
        legalName={legalName}
        centerSub={centerSub}
        centerMark={centerMark}
        isFull={isFull}
      />

      {shownChildren.length > 0 ? (
        <>
          <Connector isFull={isFull} />
          <TierNodes
            nodes={shownChildren}
            extra={extraChildren}
            isFull={isFull}
            partyId={partyId}
          />
          <TierLabel label="Controls" count={children.length} isFull={isFull} />
        </>
      ) : null}

      {isFull && ultimateParent ? (
        <p className="mt-4 text-[11px] text-muted-foreground">
          <span className="text-gold">Ultimate parent</span> resolved at{" "}
          <span className="nums tabular-nums text-foreground/85">
            {ownershipOf(ultimateParent)?.toFixed(1)}%
          </span>{" "}
          ownership.
        </p>
      ) : null}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function TierLabel({
  label,
  count,
  isFull,
}: {
  label: string;
  count: number;
  isFull: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-muted-foreground",
        isFull ? "mb-3" : "mb-2.5",
      )}
    >
      <span className="text-[10px] font-medium uppercase tracking-[0.18em]">
        {label}
      </span>
      <span className="nums tabular-nums text-[10.5px] text-muted-foreground/70">
        {count}
      </span>
    </div>
  );
}

/** A hairline connector between a tier and the center node. `mini` = a single
 *  vertical drop; `full` = a horizontal bus (spanning the tier) + a center
 *  drop, the classic org-chart connector that reads as a node-link. */
function Connector({ isFull }: { isFull: boolean }) {
  if (!isFull) {
    return <div aria-hidden className="h-5 w-px bg-hairline" />;
  }
  return (
    <div aria-hidden className="flex flex-col items-center">
      <div className="h-3 w-px bg-hairline" />
      <div className="h-px w-[min(100%,420px)] bg-hairline" />
      <div className="h-3 w-px bg-hairline" />
    </div>
  );
}

function CenterNode({
  legalName,
  centerSub,
  centerMark,
  isFull,
}: {
  legalName: string;
  centerSub?: React.ReactNode;
  centerMark?: React.ReactNode;
  isFull: boolean;
}) {
  return (
    <div
      className={cn(
        // Emerald-ringed center node - the focal point. A hairline ring + faint
        // emerald tint + the party's mark + Fraunces name. The ring + tint read
        // as a lit, machined hub rather than a flat pill.
        "relative flex flex-col items-center gap-2 rounded-2xl bg-emerald/[0.06] px-4 ring-1 ring-emerald/30",
        isFull ? "py-5" : "py-3.5",
      )}
    >
      {centerMark ? <span className="shrink-0">{centerMark}</span> : null}
      <div className="flex flex-col items-center gap-0.5 text-center">
        <span
          className={cn(
            "font-light leading-tight tracking-[-0.01em] text-foreground",
            isFull ? "text-[1.15rem]" : "text-[1rem]",
          )}
        >
          {legalName}
        </span>
        {centerSub ? (
          <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
            {centerSub}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function TierNodes({
  nodes,
  extra,
  isFull,
  partyId,
}: {
  nodes: PartyPreviewRelationship[];
  extra: number;
  isFull: boolean;
  partyId: string;
}) {
  return (
    <div className="flex max-w-full flex-wrap items-stretch justify-center gap-2">
      {nodes.map((r) => (
        <RelNode key={`${partyId}-${r.relationshipId}`} r={r} isFull={isFull} />
      ))}
      {extra > 0 ? (
        <span
          className={cn(
            "nums inline-flex items-center rounded-full bg-foreground/[0.04] px-2.5 text-[11px] text-muted-foreground ring-1 ring-hairline/60",
            isFull ? "h-8" : "h-7",
          )}
        >
          +{extra} more
        </span>
      ) : null}
    </div>
  );
}

/** A relationship edge-node: the linked party's name + ownership % (mono) + a
 *  gold BO tag for beneficial owners. A machined mini-pill (outer hairline ring
 *  + faint tint) so it reads as a node in the graph, not a table cell. Magnetic
 *  hover (transform only) on the trailing arrow. */
function RelNode({
  r,
  isFull,
}: {
  r: PartyPreviewRelationship;
  isFull: boolean;
}) {
  const ownership = ownershipOf(r);
  const isBO = r.relationshipType === "beneficial_owner";
  const isUltimate = ownership != null && ownership >= 50 && r.direction === "child";
  return (
    <Link
      href={`/parties/${r.otherPartyId}`}
      className={cn(
        "group/rel inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.04] pl-2.5 pr-2 ring-1 transition-all duration-200 ease-soft hover:bg-foreground/[0.07]",
        isUltimate ? "ring-gold/45 hover:ring-gold/60" : "ring-hairline/70 hover:ring-hairline",
        isFull ? "h-8" : "h-7",
      )}
      title={`${r.relationshipType.replace(/_/g, " ")}${
        ownership != null ? ` · ${ownership.toFixed(1)}%` : ""
      }`}
    >
      <span
        className={cn(
          "max-w-[150px] truncate text-[12px] text-foreground/85 transition-colors duration-200 ease-soft group-hover/rel:text-foreground",
        )}
      >
        {r.otherPartyName}
      </span>
      {ownership != null ? (
        <span className="nums tabular-nums text-[11px] font-medium text-muted-foreground">
          {ownership.toFixed(ownership % 1 === 0 ? 0 : 1)}%
        </span>
      ) : null}
      {isBO ? (
        <span
          aria-hidden
          className="inline-flex h-4 items-center gap-0.5 rounded-full bg-gold/[0.12] px-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-gold ring-1 ring-gold/30"
        >
          BO
        </span>
      ) : null}
      <ArrowUpRight
        weight="light"
        className="size-3 text-muted-foreground/50 transition-all duration-200 ease-soft group-hover/rel:translate-x-0.5 group-hover/rel:-translate-y-0.5 group-hover/rel:text-foreground"
      />
    </Link>
  );
}
