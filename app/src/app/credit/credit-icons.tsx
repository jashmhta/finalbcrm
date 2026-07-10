"use client";

/**
 * Phosphor Light icon wrappers used by the credit SERVER pages.
 *
 * `@phosphor-icons/react` calls `React.createContext` at module top-level
 * (for its IconContext). When a server component imports phosphor directly,
 * that top-level code runs in the server bundle where the React namespace
 * interop breaks (`createContext is not a function`) under Turbopack. By
 * isolating every phosphor import behind this `"use client"` module, the
 * server bundle only ever sees a client-component reference and never
 * evaluates phosphor's module scope - the icons render via the client SSR
 * path, which is the same pattern the client list views already use.
 *
 * All icons default to `weight="light"` per the design system. className and
 * size pass through; brand primitives size the svg via `[&_svg]:size-*`.
 */
import {
  ArrowRight,
  ArrowLeft,
  Warning,
  ChartLineUp,
  Scales,
  Coins,
  ShieldStar,
  Sparkle,
  TrendUp,
  Plus,
  CheckCircle,
  Minus,
  CaretDown,
  type Icon,
  type IconProps,
} from "@phosphor-icons/react";

const light = (Comp: Icon) =>
  function LightIconWrapper(props: IconProps) {
    return <Comp weight="light" {...props} />;
  };

export const ArrowRightIcon = light(ArrowRight);
export const ArrowLeftIcon = light(ArrowLeft);
export const WarningIcon = light(Warning);
export const ChartLineUpIcon = light(ChartLineUp);
export const ScalesIcon = light(Scales);
export const CoinsIcon = light(Coins);
export const ShieldStarIcon = light(ShieldStar);
export const SparkleIcon = light(Sparkle);
export const TrendUpIcon = light(TrendUp);
export const PlusIcon = light(Plus);
export const CheckCircleIcon = light(CheckCircle);
export const MinusIcon = light(Minus);
export const CaretDownIcon = light(CaretDown);
