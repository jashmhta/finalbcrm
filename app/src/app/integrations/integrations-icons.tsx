"use client";

/**
 * Phosphor Light icon wrappers + identity metadata for the /integrations screen.
 *
 * `@phosphor-icons/react` calls `React.createContext` at module top-level
 * (for its IconContext). When a server component imports phosphor directly,
 * that top-level code runs in the server bundle where the React namespace
 * interop breaks (`createContext is not a function`) under Turbopack. By
 * isolating every phosphor import behind this `"use client"` module, the
 * server bundle only ever sees a client-component reference and never
 * evaluates phosphor's module scope - the icons render via the client SSR
 * path. This mirrors the credit-icons.tsx pattern.
 *
 * All icons default to `weight="light"` per the design system. The brand
 * primitives size the svg via `[&_svg]:size-*`, so wrappers stay size-less;
 * callers can still override with a className.
 *
 * Iteration 3 - each adapter now carries a distinct, identity-bearing glyph
 * (Bank for the AA feed, ChartLine for BSE/NSE, WhatsappLogo for the
 * WhatsApp adapter, etc.) so the wall of cards reads as a catalog of named
 * institutions rather than a row of identical plugs. The vendor map is
 * view-layer display metadata derived from the adapter names - it does not
 * touch the data registry.
 */
import {
  Bank,
  IdentificationCard,
  Certificate,
  Barcode,
  Buildings,
  Medal,
  ShieldStar,
  Envelope,
  WhatsappLogo,
  ChartLine,
  CurrencyInr,
  Vault,
  Play,
  PlayCircle,
  CircleNotch,
  X,
  CheckCircle,
  Warning,
  ArrowRight,
  ArrowUpRight,
  Lightning,
  Sparkle,
  Funnel,
  Lock,
  Plug,
  PlugsConnected,
  Gauge,
  ArrowLineRight,
  ArrowCounterClockwise,
  type Icon,
  type IconProps,
} from "@phosphor-icons/react";

const light = (Comp: Icon) =>
  function LightIconWrapper(props: IconProps) {
    return <Comp weight="light" {...props} />;
  };

export const BankIcon = light(Bank);
export const IdentificationCardIcon = light(IdentificationCard);
export const CertificateIcon = light(Certificate);
export const BarcodeIcon = light(Barcode);
export const BuildingsIcon = light(Buildings);
export const MedalIcon = light(Medal);
export const ShieldStarIcon = light(ShieldStar);
export const EnvelopeIcon = light(Envelope);
export const WhatsappLogoIcon = light(WhatsappLogo);
export const ChartLineIcon = light(ChartLine);
export const CurrencyInrIcon = light(CurrencyInr);
export const VaultIcon = light(Vault);
export const PlayIcon = light(Play);
export const PlayCircleIcon = light(PlayCircle);
export const CircleNotchIcon = light(CircleNotch);
export const XIcon = light(X);
export const CheckCircleIcon = light(CheckCircle);
export const WarningIcon = light(Warning);
export const ArrowRightIcon = light(ArrowRight);
export const ArrowUpRightIcon = light(ArrowUpRight);
export const LightningIcon = light(Lightning);
export const SparkleIcon = light(Sparkle);
export const FunnelIcon = light(Funnel);
export const LockIcon = light(Lock);
export const PlugIcon = light(Plug);
export const PlugsConnectedIcon = light(PlugsConnected);
export const GaugeIcon = light(Gauge);
export const ArrowLineRightIcon = light(ArrowLineRight);
export const ArrowCounterClockwiseIcon = light(ArrowCounterClockwise);

/**
 * One distinct Phosphor Light glyph per adapter id - chosen for institutional
 * identity, not generic "integration" semantics. Single source for card +
 * drawer so the glyph stays consistent across the surface.
 */
export const ADAPTER_ICONS: Record<
  string,
  (props: IconProps) => React.JSX.Element
> = {
  accountAggregator: BankIcon,
  kra: IdentificationCardIcon,
  ckyc: CertificateIcon,
  gstinPan: BarcodeIcon,
  mca: BuildingsIcon,
  ratingFeed: MedalIcon,
  fiuInd: ShieldStarIcon,
  emailCalendar: EnvelopeIcon,
  whatsapp: WhatsappLogoIcon,
  bseNse: ChartLineIcon,
  ccil: CurrencyInrIcon,
  demat: VaultIcon,
};

/**
 * Vendor micro-text per adapter - the named institution / consortium behind
 * each feed, rendered as quiet Geist Mono small-cap text under the adapter
 * name. View-layer display metadata only; the data registry is untouched.
 */
export const ADAPTER_VENDOR: Record<string, string> = {
  accountAggregator: "Sahamati",
  kra: "CVL · CAMS · Kfintech · NDML",
  ckyc: "CERSAI",
  gstinPan: "GSTN · NSDL",
  mca: "MCA21",
  ratingFeed: "CRISIL · ICRA · CARE · India Ratings",
  fiuInd: "FIU-IND",
  emailCalendar: "Microsoft · Google",
  whatsapp: "Meta · WhatsApp",
  bseNse: "BSE · NSE",
  ccil: "CCIL",
  demat: "CDSL · NSDL",
};
