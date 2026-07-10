# Agent 061 — Extreme detail analysis

Batch files: `src/components/ui/label.tsx`, `src/components/ui/select.tsx`, `src/components/ui/separator.tsx`, `src/components/ui/sheet.tsx`

These are shadcn-style Base UI wrappers in the design-system primitive layer. They have no domain logic, no DB, and no RBAC; they exist so product forms (admin, credit, KYC, deals) share one accessible control language.

---

## `src/components/ui/label.tsx`

- **Lines:** 21 | **Role:** Client form label primitive
- **Exports:**
  - `function Label({ className, ...props }: React.ComponentProps<"label">)` → renders native `<label data-slot="label">`
- **Imports:** `react`; `@/lib/utils` (`cn`)
- **Business purpose & domain concepts:** None. Presentational only. Used next to inputs for party/deal/credit forms.
- **Key logic / algorithms / data shapes:**
  - Classes: `flex items-center gap-2 text-sm leading-none font-medium select-none`
  - Disabled via group/peer: `group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50`
  - Spreads all native label props (`htmlFor`, children, etc.)
- **Side effects:** None (client render only)
- **Security / RBAC:** None
- **Coupling:** Consumed by feature forms; couples only to `cn`
- **Risks / TODOs:** No association enforcement beyond browser `htmlFor`; misuse leaves orphan labels for a11y audits

---

## `src/components/ui/select.tsx`

- **Lines:** 202 | **Role:** Full Select compound component on `@base-ui/react/select`
- **Exports:**
  - `const Select = SelectPrimitive.Root` (uncontrolled/controlled root)
  - `function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props)`
  - `function SelectValue({ className, ...props }: SelectPrimitive.Value.Props)`
  - `function SelectTrigger({ className, size = "default", children, ...props }: SelectPrimitive.Trigger.Props & { size?: "sm" | "default" })`
  - `function SelectContent({ className, children, side = "bottom", sideOffset = 4, align = "center", alignOffset = 0, alignItemWithTrigger = true, ...props }: SelectPrimitive.Popup.Props & Pick<SelectPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger">)`
  - `function SelectLabel({ className, ...props }: SelectPrimitive.GroupLabel.Props)`
  - `function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props)`
  - `function SelectSeparator(...)`
  - `function SelectScrollUpButton(...)` / `SelectScrollDownButton(...)`
- **Imports:** `react`; `@base-ui/react/select`; `lucide-react` (`ChevronDownIcon`, `CheckIcon`, `ChevronUpIcon`); `@/lib/utils`
- **Business purpose:** Dropdown for enum-heavy CRM fields (desk, deal_type, obligor_type, kyc status, rating agency, etc.) without domain awareness.
- **Key logic:**
  - Portal + Positioner + Popup stack; popup width tracks anchor via `w-(--anchor-width)`
  - Animations: `data-open:animate-in fade-in-0 zoom-in-95` / close counterparts; side-specific slide-ins
  - Item indicator: absolute right checkmark via `SelectPrimitive.ItemIndicator`
  - Scroll arrows for long option lists (rating ladders, sectors)
  - Sizes: `data-[size=default]:h-8`, `data-[size=sm]:h-7`
  - Invalid: `aria-invalid:border-destructive` + ring
- **Side effects:** None beyond client DOM/portal
- **Security / RBAC:** None; option lists must be filtered upstream
- **Coupling:** Base UI select API (not Radix); product must use Base UI value/onValueChange contracts
- **Risks / TODOs:** Long class strings hard to theme; `alignItemWithTrigger` can disable animation (`data-[align-trigger=true]:animate-none`)

---

## `src/components/ui/separator.tsx`

- **Lines:** 26 | **Role:** Visual/a11y separator
- **Exports:**
  - `function Separator({ className, orientation = "horizontal", ...props }: SeparatorPrimitive.Props)`
- **Imports:** `@base-ui/react/separator`; `@/lib/utils`
- **Business purpose:** Section dividers in sheets, cards, admin panels
- **Key logic:** `data-horizontal:h-px data-horizontal:w-full` vs `data-vertical:w-px data-vertical:self-stretch`; `shrink-0 bg-border`
- **Side effects / Security / Coupling:** None / none / Base UI
- **Risks / TODOs:** Decorative vs semantic role depends on Base UI defaults + caller `decorative` props

---

## `src/components/ui/sheet.tsx`

- **Lines:** 139 | **Role:** Side-drawer dialog (sheet) built on Dialog primitive
- **Exports:** `Sheet`, `SheetTrigger`, `SheetClose`, `SheetContent`, `SheetHeader`, `SheetFooter`, `SheetTitle`, `SheetDescription` (note: `SheetPortal`/`SheetOverlay` are internal, not exported)
- **Imports:** `react`; `@base-ui/react/dialog` as `SheetPrimitive`; `lucide-react` `XIcon`; `@/components/ui/button`; `@/lib/utils`
- **Business purpose:** Slide-over panels for filters, party preview, deal detail drawers, admin editors without full-page nav
- **Key logic / data shapes:**
  - `SheetContent` props: `side?: "top" | "right" | "bottom" | "left"` (default `"right"`), `showCloseButton?: boolean` (default true)
  - Overlay: `fixed inset-0 z-50 bg-black/10` + optional `backdrop-blur-xs`
  - Side animations: translate ±2.5rem on enter/exit via `data-starting-style` / `data-ending-style`
  - Left/right: `w-3/4 sm:max-w-sm` full height; top/bottom: `h-auto` with border edges
  - Close button: ghost `Button` `size="icon-sm"` absolute top-right with sr-only "Close"
- **Side effects:** Focus trap / body scroll lock via Base UI Dialog
- **Security / RBAC:** None; do not put secrets in client-only sheet state
- **Coupling:** Dialog primitive reused as sheet (naming abstraction only); depends on brand `Button`
- **Risks / TODOs:** `SheetPortal` not exported — advanced portal targeting requires forking; long mobile forms may need internal scroll region (not provided)
