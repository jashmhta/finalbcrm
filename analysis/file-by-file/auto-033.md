
# Batch 033

## `src/app/loading.tsx`

- **Lines:** 23 | **Bytes:** 1055
- **Kind:** Application module
- **Default export:** yes
- **Security signals:** india-compliance
- **Internal imports (1):** @/components/brand/skeleton
- **Domain terms:** kyc

## `src/app/login/actions.ts`

- **Lines:** 58 | **Bytes:** 1889
- **Kind:** Server Actions module
- **Directive:** `use server`
- **Exported functions:** login
- **Exported types:** LoginState
- **Zod schemas:** loginSchema
- **External deps:** next-auth, zod/v4
- **Internal imports (1):** @/lib/auth

## `src/app/login/login-form.tsx`

- **Lines:** 127 | **Bytes:** 3229
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** LoginForm
- **External deps:** @phosphor-icons/react, react, react-dom
- **Internal imports (3):** ./actions, @/components/brand/button, @/lib/utils
- **Domain terms:** binarycapital

## `src/app/login/page.tsx`

- **Lines:** 106 | **Bytes:** 3756
- **Kind:** Next.js page route
- **Header intent:** Login — public surface. Stripe-level split: brand panel + clean form card.
- **Exported const:** metadata, dynamic
- **Default export:** yes
- **Security signals:** rbac/rls, india-compliance
- **External deps:** next, next/image, next/link
- **Internal imports (3):** @/components/logo.png, ./login-form, @/components/brand/card
- **Domain terms:** binarycapital
