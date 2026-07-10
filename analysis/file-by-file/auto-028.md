
# Batch 028

## `src/app/global-error.tsx`

- **Lines:** 75 | **Bytes:** 3061
- **Kind:** Client component
- **Directive:** `use client`
- **Default export:** yes
- **Security signals:** india-compliance
- **External deps:** react

## `src/app/globals.css`

- **Lines:** 366 | **Bytes:** 10269
- **Kind:** Application module

## `src/app/integrations/adapter-card.tsx`

- **Lines:** 934 | **Bytes:** 37526
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** AdapterCard
- **Exported types:** AdapterRunState, AdapterCardProps
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, react
- **Internal imports (10):** @/components/ui/sheet, @/lib/utils, @/components/brand/button, @/components/brand/card, @/components/brand/badge, @/components/brand, @/features/integrations/registry, @/features/integrations/types, ./integrations-icons, ./adapter-meta
- **Domain terms:** onboarding, party

## `src/app/integrations/adapter-meta.ts`

- **Lines:** 188 | **Bytes:** 8789
- **Kind:** Application module
- **Header intent:** View-layer metadata for the /integrations CONNECTION CARDS.  This module is DISPLAY-ONLY derivation. DATA_FLOW + ADAPTER_HEALTH + the category labels are read off each adapter's own access-requirement / cost-risk text (in @/features/integrations/*) and surfaced as the control-panel's "what data flows" + "how ready is Binary to actually connect" gauges. They do NOT touch the data registry, the Server Actions, zod, or force-dynamic - the data layer is preserved exactly. If a field is missing from 
- **Exported functions:** readinessTone, deriveConnectionState
- **Exported const:** CATEGORY_ORDER, CATEGORY_LABEL, CATEGORY_BLURB, DATA_FLOW, ADAPTER_HEALTH
- **Exported types:** IntegrationCategory, DataFlow, AdapterHealth, ConnectionState
- **Security signals:** india-compliance
- **Internal imports (2):** @/features/integrations/types, @/features/integrations/registry
- **Domain terms:** Demat, KYC, demat, issuer, kyc, onboarding
