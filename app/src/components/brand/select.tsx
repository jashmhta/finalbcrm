"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { CaretDown, CaretUp, Check } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

/**
 * Select - double-bezel dropdown. The trigger is a hairline-ringed field with
 * the machined inset top highlight (bezel-hi) so it matches the Card enclosure;
 * the content is a floating glass popup (shadow-floating + backdrop-blur-xl,
 * permitted because the popup is a fixed/portal layer). Phosphor Light glyphs
 * replace the banned thick Lucide chevrons.
 *
 * Wraps @base-ui/react/select with the same surface API as the shadcn Select
 * (Select / SelectTrigger / SelectValue / SelectContent / SelectItem / …) so
 * it drops in anywhere the shadcn select is used.
 */
const Select = SelectPrimitive.Root;

function SelectGroup({
  className,
  ...props
}: SelectPrimitive.Group.Props) {
  return (
    <SelectPrimitive.Group
      data-slot="brand-select-group"
      className={cn("scroll-my-1 p-1", className)}
      {...props}
    />
  );
}

function SelectValue({
  className,
  ...props
}: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="brand-select-value"
      className={cn("flex flex-1 text-left", className)}
      {...props}
    />
  );
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: "sm" | "default";
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="brand-select-trigger"
      data-size={size}
      className={cn(
        "bezel-hi flex w-fit items-center justify-between gap-1.5 rounded-md bg-surface py-2 pr-2.5 pl-3.5 text-[13.5px] whitespace-nowrap text-foreground",
        "ring-1 ring-hairline transition-all duration-200 ease-soft outline-none select-none",
        "focus:ring-gold/60",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:ring-down/45 aria-invalid:ring-1",
        "data-placeholder:text-muted-foreground",
        "data-[size=default]:h-10 data-[size=sm]:h-8 data-[size=sm]:rounded-lg",
        "*:data-[slot=brand-select-value]:line-clamp-1 *:data-[slot=brand-select-value]:flex *:data-[slot=brand-select-value]:items-center *:data-[slot=brand-select-value]:gap-1.5",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={
          <CaretDown
            weight="light"
            className="pointer-events-none size-4 text-muted-foreground"
          />
        }
      />
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 6,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = true,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
  >) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="brand-select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn(
            "relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-md bg-popover/90 text-popover-foreground ring-1 ring-hairline shadow-floating backdrop-blur-xl supports-[backdrop-filter]:bg-popover/80",
            "duration-100 data-[align-trigger=true]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({
  className,
  ...props
}: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="brand-select-label"
      className={cn(
        "px-1.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="brand-select-item"
      className={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-lg py-1.5 pr-8 pl-2.5 text-[13.5px] outline-hidden select-none transition-colors duration-150 ease-soft",
        "text-foreground/85 focus:bg-foreground/[0.06] focus:text-foreground",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "*:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center text-gold" />
        }
      >
        <Check weight="light" className="pointer-events-none" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({
  className,
  ...props
}: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="brand-select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-hairline", className)}
      {...props}
    />
  );
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="brand-select-scroll-up-button"
      className={cn(
        "top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover/80 py-1 backdrop-blur-xl [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <CaretUp weight="light" />
    </SelectPrimitive.ScrollUpArrow>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="brand-select-scroll-down-button"
      className={cn(
        "bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover/80 py-1 backdrop-blur-xl [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <CaretDown weight="light" />
    </SelectPrimitive.ScrollDownArrow>
  );
}

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
};
