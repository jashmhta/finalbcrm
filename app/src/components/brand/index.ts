// Brand primitives - Stripe-level day theme building blocks.

export {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/brand/card";
export { Button, ButtonIcon, buttonVariants } from "@/components/brand/button";
export type { ButtonProps } from "@/components/brand/button";
export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  TableEmpty,
  useDensity,
  useTableContext,
} from "@/components/brand/table";
export type { Density } from "@/components/brand/table";
export { Badge, badgeVariants, ActionBadge, ACTION_VARIANT, actionFromVerb } from "@/components/brand/badge";
export type { BadgeProps, ActionBadgeProps, ActionType } from "@/components/brand/badge";
// Empty-state - designed "no data" / "awaiting input" surfaces for dense data
// screens. EmptyState for full regions (table empty rows, rails), CellEmpty
// for inline table cells (replaces the bare "-" the critic flagged on the
// credit FS table + bond-calc schedule).
export { EmptyState, CellEmpty } from "@/components/brand/empty-state";
export type { EmptyStateProps } from "@/components/brand/empty-state";
export { Eyebrow, SectionHeading, PageHeader } from "@/components/brand/text";
export {
  PageShell,
  PageHeader as ProductPageHeader,
  KpiStrip,
} from "@/components/brand/page-shell";
export {
  Skeleton,
  SkeletonCard,
  SkeletonBoard,
  SkeletonPage,
} from "@/components/brand/skeleton";
export { StatCard } from "@/components/brand/stat-card";
export type { StatCardProps } from "@/components/brand/stat-card";
export { ScoreRing } from "@/components/brand/score-ring";
export type { ScoreRingProps } from "@/components/brand/score-ring";
export {
  Money,
  Num,
  formatMoney,
  compactINR,
} from "@/components/brand/money";
export type { MoneyProps, MoneyOptions } from "@/components/brand/money";
export { CommandBar } from "@/components/brand/command-bar";
export type { CommandBarProps } from "@/components/brand/command-bar";
export {
  Reveal,
  Stagger,
  StaggerItem,
  staggerContainer,
  staggerItem,
} from "@/components/brand/reveal";
// Form primitives - double-bezel Input / Select / Tabs. Drop-in replacements
// for the shadcn ui/* equivalents; screen agents should prefer these so
// fields match the Card enclosure system.
export { Input, InputGroup } from "@/components/brand/input";
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/brand/select";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/brand/tabs";
// Chart theme - reusable recharts constants, gradient defs, the double-bezel
// ChartTooltip, and a ChartCard wrapper. Screen agents should import from here
// instead of re-deriving chart styling per screen.
export {
  CHART_GRID_STROKE,
  CHART_AXIS_TICK,
  CHART_STROKE_WIDTH,
  CHART_EASE,
  CHART_GRID_PROPS,
  CHART_XAXIS_PROPS,
  CHART_YAXIS_PROPS,
  CHART_CURSOR,
  CHART_SERIES,
  CHART_ACTIVE_DOT,
  ChartAreaGradient,
  ChartStrokeGradient,
  ChartTooltip,
  ChartCard,
} from "@/components/brand/chart-theme";
export type { ChartTooltipProps } from "@/components/brand/chart-theme";

// Icon language - the bespoke iconography layer. `IconTile` is the consistent
// hairline-disc well that frames a Phosphor Light glyph at 16/20/24 in four
// tones; the custom MARKS (Binary B, bond/coupon, rating ladder, exposure
// gauge, mandate seal, KYC shield, G-Sec) are the CRM's own brand-concept
// vocabulary, distinct from stock icons. The `ICON` map keys them for
// type-coded rows. Re-exported from icons.tsx (the phosphor client boundary)
// via this module so screen agents get one import path for all iconography.
export {
  IconTile,
  BinaryBMark,
  BondCouponMark,
  RatingLadderMark,
  ExposureGaugeMark,
  MandateMark,
  KycShieldMark,
  GSecRupeeMark,
  ICON,
} from "@/components/brand/icon-language";
export type {
  IconTone,
  IconSize,
  IconTileProps,
  MarkProps,
  IconKey,
  IconMarkComponentProps,
} from "@/components/brand/icon-language";

// PreviewPane - the right-hand sticky detail pane for list+detail explorer
// layouts (parties explorer first). Double-bezel Card shell, eyebrow type +
// Fraunces name header, compositional body slot for a mini relationship graph
// / recent deals / exposure. Server-component-safe (slots are ReactNodes).
export { PreviewPane } from "@/components/brand/preview-pane";
export type { PreviewPaneProps } from "@/components/brand/preview-pane";
