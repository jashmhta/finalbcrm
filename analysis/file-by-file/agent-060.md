# Agent 060 — File-by-file analysis

**Batch:** `batch-060.list`  
**App root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4  
**Scope:** shadcn/ui card, dialog, dropdown-menu, input.

---

## 1. `src/components/ui/card.tsx`

| Field | Value |
|--------|--------|
| **Role** | Generic shadcn Card primitives |

### Exports

Typically `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` (shadcn pattern).

### Business purpose

Low-level card; product screens prefer `@/components/brand/card`.

### Coupling / Risks

Using ui Card inside brand pages causes visual inconsistency (shadows/radius differ).

---

## 2. `src/components/ui/dialog.tsx`

| Field | Value |
|--------|--------|
| **Role** | Modal dialog system (base-ui / Radix-style) |

### Exports

```ts
Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogClose, ...
```

### Business purpose

Foundation for NewPartyDialog, NewTaskDialog, EditLimitDialog, etc. Brand restyles content via className (double-bezel override, transparent bg).

### Key patterns in consumers

- `DialogTrigger render={<Button .../>}` base-ui render prop.
- Content className resets default max-width/padding.

### Security

Focus trap / escape; no auth. Forms inside submit server actions.

### Risks

1. Portal stacking vs sticky nav z-index.
2. Mobile height overflow — consumers add max-h + overflow-y.
3. API differs from classic Radix if training data assumes `asChild` only.

---

## 3. `src/components/ui/dropdown-menu.tsx`

| Field | Value |
|--------|--------|
| **Role** | Menu popovers |

### Business purpose

SiteNav user menu / overflow menus; base-ui dropdown.

### Coupling

SiteNav imports DropdownMenu* heavily.

### Risks

1. Touch target sizes on mobile.
2. Nested menus complexity.
3. Must portal above sticky chrome.

---

## 4. `src/components/ui/input.tsx`

| Field | Value |
|--------|--------|
| **Role** | Base text input |

### Business purpose

Generic input styles; brand Input preferred for product forms.

### Risks

Dual input systems with brand BezelInput/local dialog inputs — three styles coexist.

---

## Cross-file summary (batch 060)

UI kit layer under brand. Dialogs are critical for all create/edit mutations in app routes analyzed by MEGA-C.

### Highest-priority risks

1. Design system dualism (ui vs brand).
2. Dialog accessibility and scroll on small screens.
3. z-index wars with nav/bell.

---

*End of agent-060 analysis.*
