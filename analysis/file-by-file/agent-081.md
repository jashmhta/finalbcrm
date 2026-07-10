# Agent 081 — File-by-file analysis (batch-081)

Files: whatsapp.ts, interactions/actions.ts, interactions/queries.ts, leads/actions.ts | Fully read

---

## src/features/integrations/whatsapp.ts

- **Lines:** 254  
- **Role:** WhatsApp Business Cloud API adapter (Meta). Phase 1 communication. Template messaging + opt-in registry.

- **Exports:** `WhatsappMessage`, `WhatsappData`, `WhatsappSendRequest`, `buildWhatsappSample`, `WhatsappClient`, `whatsapp`.

- **Key logic:**
  - Mock: outbound allocation confirmation template + inbound ACK; optIn true.
  - Real: WHATSAPP_TOKEN + PHONE_NUMBER_ID; POST `/v21.0/{phoneNumberId}/messages` template send; GET log path (business account or phone id).
  - Env keys not fully in .env.example.

- **Business purpose:** Investor/issuer utility messages under Meta category pricing; SEBI/RBI retention; opt-in required.

- **Security:** Marketing templates require opt-in; token is long-lived Meta secret. Adapter `run` currently **fetchLog**, not send — sendTemplate exists but not wired to `run`.

- **Risks:** No CRM opt-in table write; no interaction logging on send.

---

## src/features/interactions/actions.ts

- **Lines:** 224  
- **Role:** `"use server"` mutations for interaction timeline (DATA_MODEL §2.18). Create with attendees; light update of descriptive fields.

- **Exports:**
  - `CreateInteractionState`, `createInteraction(prev, formData)`
  - `UpdateInteractionState`, `updateInteraction(prev, formData)`

- **Imports:** revalidatePath, redirect, zod/v4, eq; rbac; withRls; `interaction`, `interactionAttendee`.

- **Key logic — create:**
  - Channels: meeting/call/email/whatsapp/rfq/ndsom_chat/site_visit/management_presentation.
  - Attendees JSON array max 50; roles host/chair/presenter/issuer_side/investor_side/advisor/observer/other.
  - **Anchor rule:** at least one of partyId/dealId/contactId (DB CHECK backstop + friendly error).
  - Single RLS txn: insert interaction + bulk insert attendees; userId = appUserId; containsMnpi checkbox; barrierId optional.
  - Redirect `/interactions/{id}`.

- **Key logic — update:** only subject/body/nextAction; no anchor/attendee edits; no row-existence check before update.

- **Security:** `create:interaction` / `update:interaction`. MNPI flag user-settable. Attendee JSON parse failures → empty array (silent).

- **Risks:** update doesn't verify visibility of interaction; no delete; attendees immutable post-create.

---

## src/features/interactions/queries.ts

- **Lines:** 365  
- **Role:** Server-side interaction list/detail + form option loaders. App-layer visibility until RLS policies land.

- **Exports:**
  - Types: `InteractionListItem`, `InteractionListFilters`, `InteractionListResult`, `InteractionAttendeeRow`, `InteractionDetail`, `PartyOption`, `DealOption`, `ContactOption`
  - `listInteractions`, `getInteractionDetail`, `listPartyOptions`, `listDealOptions`, `listContactOptions`

- **Visibility:** admin/super_admin / read_all:interaction / manage:user OR ownership chain (interaction.userId, party/deal/contact creator/assignee/owner, party_contact EXISTS).

- **listInteractions:** filters anchors, mnpiOnly, channel, direction, multi-field ilike q; parallel count; attendee counts batched by groupBy (no N+1); order occurredAt desc.

- **getInteractionDetail:** full interaction row + attendees join contact + optional primaryContact lookup.

- **Option lists:** **unscoped** (no user param) — any caller listing parties/deals/contacts for the form gets global options up to limit 50. Document queries version **does** scope; interactions do not.

- **Security gap:** form option loaders lack visibility clauses — information leak of party/deal/contact names to any authenticated page that imports them without further filtering.

- **Coupling:** Used by leads detail (listInteractions reuse), interaction pages, lead notes.

---

## src/features/leads/actions.ts

- **Lines:** 702  
- **Role:** Lead & Opportunity Management mutations. `lead_meta` JSONB on party (migration 0006) via raw SQL inside withRls. Funnel: new → BANT → qualified → opportunity → won/lost.

- **Exports (async only — "use server" constraint):**
  - `createLead`, `updateBant`, `convertToOpportunity`, `updateProbability`, `updateExpectedClose`, `updateAssignedRm`, `winLead`, `loseLead`, `addLeadNote`, `deleteLead`
  - State types for each

- **Key workflows:**
  1. **createLead:** mode new|existing; new inserts party onboarding+prospect type; existing requires no existing lead_meta; stamps stage new + BANT false.
  2. **updateBant:** toggles criterion from **DB current value** (not form value — fixes multi-button form bug); auto-promote new→qualified when fully BANT.
  3. **convertToOpportunity:** requires isQualified BANT; blocks closed stages.
  4. **winLead:** needs update:party + create:deal; inserts deal status=mandated brand=binarybonds + deal_party issuer|target; stamps convertedDealId/closedAt.
  5. **loseLead:** loss reason enum; blocks winning a lost path reverse.
  6. **addLeadNote:** bumps updatedAt + inserts interaction channel=call.
  7. **deleteLead:** sets lead_meta NULL (party remains).

- **mutateLeadMeta / runLeadMutation:** load → clone bant → fn → stamp updatedAt → write JSONB.

- **Security:** party create/update + deal create permissions. No dedicated lead:* permissions — rides party/deal.

- **Side effects:** party/deal/deal_party/interaction writes; revalidate /leads /deals; createLead redirects.

- **Risks:**
  - dealCode `BC-{year}-{partyId.slice(0,4)}` may collide.
  - winLead target_size = estSizeCr * 1e7 (absolute INR) — unit consistency with deals feature crores convention needs care.
  - deleteLead does not reverse won deal.
  - Note documents intentional ban on non-async re-exports from use server modules.

---

## Batch 081 synthesis

Integrations closes with WhatsApp; interactions feature full CRUD-lite; leads mutations implement complete BANT funnel with deal conversion. Cross-feature reuse: lead notes → interaction rows; lead detail will use interaction queries.
