"use client";

import * as React from "react";
import { motion, type Variants } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * Reveal - the shared entry-motion primitive. Framer Motion `whileInView`:
 * opacity-0 translate-y-4 blur-sm → 0, with --ease-soft. GPU-disciplined:
 * only transform + opacity (blur is a paint effect but bounded to the entry
 * tween, not a scroll listener). `once` so it never re-fires.
 */

const EASE = [0.32, 0.72, 0, 1] as const;

export interface RevealProps {
  children: React.ReactNode;
  /** Delay (s) before the entry tween starts. */
  delay?: number;
  /** Translate distance (px). */
  y?: number;
  /** Duration (s). */
  duration?: number;
  /** Render as a different element/tag. */
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  /** Disable blur (use on text-heavy blocks where blur reads as fuzzy). */
  noBlur?: boolean;
  once?: boolean;
  amount?: number;
}

export function Reveal({
  children,
  delay = 0,
  y = 16,
  duration = 0.6,
  as = "div",
  className,
  noBlur = false,
  once = true,
  amount = 0.2,
}: RevealProps) {
  const MotionTag = motion[as as "div"] as typeof motion.div;
  return (
    <MotionTag
      initial={{ opacity: 0, y, filter: noBlur ? "none" : "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once, amount, margin: "-8%" }}
      transition={{ duration, delay, ease: EASE }}
      className={className}
    >
      {children}
    </MotionTag>
  );
}

/** Stagger container - wraps StaggerItem children; orchestrates the cascade. */
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.04, delayChildren: 0.04 },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.55, ease: EASE },
  },
};

export function Stagger({
  children,
  className,
  as = "div",
  amount = 0.15,
  once = true,
}: {
  children: React.ReactNode;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
  amount?: number;
  once?: boolean;
}) {
  const MotionTag = motion[as as "div"] as typeof motion.div;
  return (
    <MotionTag
      variants={staggerContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once, amount, margin: "-6%" }}
      className={className}
    >
      {children}
    </MotionTag>
  );
}

export function StaggerItem({
  children,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
}) {
  const MotionTag = motion[as as "div"] as typeof motion.div;
  return (
    <MotionTag variants={staggerItem} className={cn(className)}>
      {children}
    </MotionTag>
  );
}
