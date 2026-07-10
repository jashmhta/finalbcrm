"use client";

import * as React from "react";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";

import { cn } from "@/lib/utils";

/**
 * Tabs - hairline pill segments with an inset active state. The list is a
 * recessed pill track (ring-1 hairline + faint bg); the active trigger lifts
 * into a machined inset pill (bg-surface + bezel-hi + ring) so it reads as
 * raised, mirroring the double-bezel enclosure system.
 *
 * Wraps @base-ui/react/tabs with the same surface API as the shadcn Tabs so
 * it composes with TabsList / TabsTrigger / TabsContent unchanged.
 */
function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="brand-tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className,
      )}
      {...props}
    />
  );
}

function TabsList({
  className,
  ...props
}: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="brand-tabs-list"
      className={cn(
        "bezel-hi inline-flex w-fit items-center gap-0.5 rounded-full bg-foreground/[0.04] p-0.5 ring-1 ring-hairline",
        "group-data-vertical/tabs:flex-col group-data-vertical/tabs:h-fit",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="brand-tabs-trigger"
      className={cn(
        "relative inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium whitespace-nowrap text-muted-foreground transition-all duration-200 ease-soft outline-none",
        "hover:text-foreground",
        // Active = machined inset pill: raised surface + bezel top highlight +
        // hairline ring. base-ui sets data-active on the selected tab.
        "data-active:bg-surface data-active:text-foreground data-active:shadow-soft data-active:bezel-hi data-active:ring-1 data-active:ring-hairline",
        "group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start",
        "focus-visible:ring-2 focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="brand-tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
