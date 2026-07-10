# Domain Area Rollup

## components — 38 files, ~6326 LOC

- `src/components/brand/badge.tsx` (175 lines)
- `src/components/brand/button.tsx` (140 lines)
- `src/components/brand/card.tsx` (128 lines)
- `src/components/brand/chart-theme.tsx` (258 lines) [client]
- `src/components/brand/command-bar.tsx` (231 lines) [client]
- `src/components/brand/empty-state.tsx` (81 lines)
- `src/components/brand/icon-language.tsx` (452 lines) [client]
- `src/components/brand/icons.tsx` (184 lines) [client]
- `src/components/brand/index.ts` (136 lines)
- `src/components/brand/input.tsx` (81 lines)
- `src/components/brand/money.tsx` (176 lines)
- `src/components/brand/page-shell.tsx` (138 lines)
- `src/components/brand/page-transition.tsx` (58 lines) [client]
- `src/components/brand/preview-pane.tsx` (138 lines)
- `src/components/brand/reveal.tsx` (119 lines) [client]
- `src/components/brand/score-ring.tsx` (183 lines) [client]
- `src/components/brand/select.tsx` (238 lines) [client]
- `src/components/brand/skeleton.tsx` (222 lines)
- `src/components/brand/stat-card.tsx` (189 lines) [client]
- `src/components/brand/table.tsx` (246 lines) [client]
- `src/components/brand/tabs.tsx` (83 lines) [client]
- `src/components/brand/text.tsx` (121 lines)
- `src/components/notification-bell.tsx` (326 lines) [client]
- `src/components/site-nav.tsx` (920 lines) [client]
- `src/components/theme-provider.tsx` (11 lines) [client]
- `src/components/ui/badge.tsx` (52 lines)
- `src/components/ui/button.tsx` (58 lines)
- `src/components/ui/card.tsx` (103 lines)
- `src/components/ui/dialog.tsx` (160 lines) [client]
- `src/components/ui/dropdown-menu.tsx` (268 lines) [client]
- `src/components/ui/input.tsx` (20 lines)
- `src/components/ui/label.tsx` (20 lines) [client]
- `src/components/ui/select.tsx` (201 lines) [client]
- `src/components/ui/separator.tsx` (25 lines) [client]
- `src/components/ui/sheet.tsx` (138 lines) [client]
- `src/components/ui/sonner.tsx` (49 lines) [client]
- `src/components/ui/table.tsx` (116 lines) [client]
- `src/components/ui/tabs.tsx` (82 lines) [client]

## db — 25 files, ~10119 LOC

- `src/db/context.ts` (159 lines)
- `src/db/domain-check.ts` (165 lines)
- `src/db/index.ts` (68 lines)
- `src/db/rls.ts` (363 lines)
- `src/db/schema/audit.ts` (129 lines)
- `src/db/schema/auth.ts` (159 lines)
- `src/db/schema/compliance.ts` (175 lines)
- `src/db/schema/contact.ts` (179 lines)
- `src/db/schema/credit.ts` (989 lines)
- `src/db/schema/deals.ts` (464 lines)
- `src/db/schema/demat.ts` (64 lines)
- `src/db/schema/documents.ts` (113 lines)
- `src/db/schema/enums.ts` (768 lines)
- `src/db/schema/index.ts` (41 lines)
- `src/db/schema/information_barrier.ts` (128 lines)
- `src/db/schema/interactions.ts` (183 lines)
- `src/db/schema/modeling.ts` (116 lines)
- `src/db/schema/party.ts` (460 lines)
- `src/db/schema/rbac.ts` (319 lines)
- `src/db/schema/relationship.ts` (98 lines)
- `src/db/schema/tasks.ts` (145 lines)
- `src/db/seed-admin.ts` (133 lines)
- `src/db/seed-org-users.ts` (235 lines)
- `src/db/seed-scale.ts` (716 lines) [todos:2]
- `src/db/seed.ts` (3750 lines) [server]

## features/integrations — 17 files, ~3765 LOC

- `src/features/integrations/accountAggregator.ts` (297 lines) [todos:6]
- `src/features/integrations/actions.ts` (99 lines) [server]
- `src/features/integrations/bseNse.ts` (246 lines)
- `src/features/integrations/ccil.ts` (215 lines)
- `src/features/integrations/ckyc.ts` (240 lines) [todos:2]
- `src/features/integrations/demat.ts` (194 lines)
- `src/features/integrations/emailCalendar.ts` (236 lines)
- `src/features/integrations/env.ts` (460 lines) [client]
- `src/features/integrations/fiuInd.ts` (332 lines)
- `src/features/integrations/gstinPan.ts` (257 lines)
- `src/features/integrations/kra.ts` (205 lines) [todos:2]
- `src/features/integrations/mca.ts` (191 lines)
- `src/features/integrations/queries.ts` (43 lines)
- `src/features/integrations/ratingFeed.ts` (220 lines)
- `src/features/integrations/registry.ts` (154 lines)
- `src/features/integrations/types.ts` (123 lines)
- `src/features/integrations/whatsapp.ts` (253 lines)

## app/modeling — 15 files, ~5209 LOC

- `src/app/modeling/[id]/page.tsx` (806 lines)
- `src/app/modeling/bond-calculator/bond-calculator-lazy.tsx` (57 lines) [client]
- `src/app/modeling/bond-calculator/bond-calculator.tsx` (1332 lines) [client]
- `src/app/modeling/bond-calculator/page.tsx` (38 lines)
- `src/app/modeling/lbo-calculator/lbo-calculator-lazy.tsx` (43 lines) [client]
- `src/app/modeling/lbo-calculator/lbo-calculator.tsx` (868 lines) [client]
- `src/app/modeling/lbo-calculator/page.tsx` (37 lines)
- `src/app/modeling/ma-calculator/ma-calculator-lazy.tsx` (43 lines) [client]
- `src/app/modeling/ma-calculator/ma-calculator.tsx` (978 lines) [client]
- `src/app/modeling/ma-calculator/page.tsx` (37 lines)
- `src/app/modeling/model-library.tsx` (301 lines) [client]
- `src/app/modeling/page.tsx` (26 lines)
- `src/app/modeling/scenario/page.tsx` (37 lines)
- `src/app/modeling/scenario/scenario-lazy.tsx` (43 lines) [client]
- `src/app/modeling/scenario/scenario.tsx` (563 lines) [client]

## tests — 14 files, ~4832 LOC

- `src/__tests__/aiSummary.test.ts` (511 lines)
- `src/__tests__/bondPricing.test.ts` (480 lines)
- `src/__tests__/kyc.test.ts` (428 lines)
- `src/__tests__/lboModel.test.ts` (192 lines)
- `src/__tests__/maModel.test.ts` (200 lines)
- `src/__tests__/matching.test.ts` (675 lines)
- `src/__tests__/ratingMap.test.ts` (324 lines)
- `src/__tests__/ratios.test.ts` (442 lines)
- `src/__tests__/rbacSegmentation.test.ts` (245 lines)
- `src/__tests__/reports.test.ts` (251 lines) [todos:1]
- `src/__tests__/routeSmoke.test.ts` (53 lines)
- `src/__tests__/scenarioAnalysis.test.ts` (188 lines)
- `src/__tests__/scorecard.test.ts` (325 lines)
- `src/__tests__/stages.test.ts` (518 lines)

## app/credit — 14 files, ~4734 LOC

- `src/app/credit/[id]/add-fs-form.tsx` (273 lines) [client]
- `src/app/credit/[id]/committee-form.tsx` (157 lines) [client]
- `src/app/credit/[id]/credit-summary-header.tsx` (287 lines) [client]
- `src/app/credit/[id]/page.tsx` (1149 lines)
- `src/app/credit/[id]/run-score-button.tsx` (67 lines) [client]
- `src/app/credit/[id]/workspace/page.tsx` (1554 lines)
- `src/app/credit/[id]/workspace/source-data-panel.tsx` (149 lines) [client]
- `src/app/credit/[id]/workspace/sparkline.tsx` (186 lines) [client]
- `src/app/credit/credit-icons.tsx` (53 lines) [client]
- `src/app/credit/credit-list-view.tsx` (460 lines) [client]
- `src/app/credit/layout.tsx` (21 lines)
- `src/app/credit/new/new-credit-analysis-form.tsx` (297 lines) [client]
- `src/app/credit/new/page.tsx` (35 lines)
- `src/app/credit/page.tsx` (46 lines)

## app/portfolio — 14 files, ~3054 LOC

- `src/app/portfolio/_components/concentration-view.tsx` (377 lines) [client]
- `src/app/portfolio/_components/edit-limit-dialog.tsx` (321 lines) [client]
- `src/app/portfolio/_components/limits-view.tsx` (482 lines) [client]
- `src/app/portfolio/_components/overview-view.tsx` (580 lines) [client]
- `src/app/portfolio/_components/portfolio-charts-impl.tsx` (543 lines) [client]
- `src/app/portfolio/_components/portfolio-charts.tsx` (75 lines) [client]
- `src/app/portfolio/_components/portfolio-sub-nav.tsx` (94 lines) [client]
- `src/app/portfolio/_components/risk-metrics-view.tsx` (263 lines) [client]
- `src/app/portfolio/concentration/page.tsx` (71 lines)
- `src/app/portfolio/layout.tsx` (30 lines)
- `src/app/portfolio/limits/page.tsx` (83 lines)
- `src/app/portfolio/loading.tsx` (9 lines)
- `src/app/portfolio/page.tsx` (98 lines)
- `src/app/portfolio/risk-metrics/page.tsx` (28 lines)

## drizzle — 13 files, ~2119 LOC

- `drizzle.config.ts` (12 lines)
- `drizzle/0000_minor_kitty_pryde.sql` (995 lines)
- `drizzle/0001_easy_scarlet_spider.sql` (64 lines)
- `drizzle/0002_auth.sql` (22 lines)
- `drizzle/0003_rls.sql` (382 lines)
- `drizzle/0004_rls_fix.sql` (111 lines)
- `drizzle/0005_indexes.sql` (146 lines)
- `drizzle/0006_leads.sql` (62 lines)
- `drizzle/0007_onboarding.sql` (80 lines)
- `drizzle/0008_users_app_user_id.sql` (60 lines)
- `drizzle/0009_rls_guc_safe.sql` (87 lines)
- `drizzle/0010_party_segmentation_rbac_filters.sql` (64 lines)
- `drizzle/0011_party_duplicate_candidates.sql` (34 lines)

## config — 13 files, ~1321 LOC

- `eslint.config.mjs` (36 lines)
- `login/actions.ts` (36 lines) [server]
- `login/login-form.tsx` (54 lines) [client]
- `login/page.tsx` (26 lines)
- `next.config.ts` (28 lines)
- `package.json` (56 lines)
- `page.tsx` (87 lines)
- `postcss.config.mjs` (7 lines)
- `src/proxy.ts` (56 lines)
- `src/scripts/import-parties.ts` (810 lines)
- `tsconfig.json` (34 lines)
- `vercel.ts` (55 lines)
- `vitest.config.ts` (36 lines)

## scripts — 11 files, ~1405 LOC

- `scripts/_audit-set2.mjs` (103 lines)
- `scripts/diag-css-links.mjs` (68 lines)
- `scripts/diag-css-timing.mjs` (86 lines)
- `scripts/diag-nav.mjs` (96 lines)
- `scripts/diag-theme-logo.mjs` (60 lines)
- `scripts/mobile-overflow-all.mjs` (131 lines)
- `scripts/mobile-pass.mjs` (223 lines)
- `scripts/screenshot.mjs` (209 lines)
- `scripts/verify-logo-theme.mjs` (101 lines)
- `scripts/verify-routes.mjs` (194 lines)
- `scripts/verify.mjs` (134 lines)

## app/compliance — 11 files, ~7453 LOC

- `src/app/compliance/audit/audit-list-view.tsx` (3298 lines) [client]
- `src/app/compliance/audit/page.tsx` (89 lines)
- `src/app/compliance/consent/consent-action-forms.tsx` (603 lines) [server,client]
- `src/app/compliance/consent/consent-view.tsx` (833 lines) [client]
- `src/app/compliance/consent/page.tsx` (104 lines)
- `src/app/compliance/kyc/[id]/kyc-action-forms.tsx` (477 lines) [server,client]
- `src/app/compliance/kyc/[id]/page.tsx` (816 lines)
- `src/app/compliance/kyc/[id]/status-timeline.tsx` (246 lines) [client]
- `src/app/compliance/kyc/kyc-board-view.tsx` (879 lines) [client]
- `src/app/compliance/kyc/loading.tsx` (56 lines)
- `src/app/compliance/kyc/page.tsx` (52 lines)

## app/reports — 11 files, ~2611 LOC

- `src/app/reports/_components/credit-report-view.tsx` (522 lines) [client]
- `src/app/reports/_components/report-charts-impl.tsx` (401 lines) [client]
- `src/app/reports/_components/report-charts.tsx` (63 lines) [client]
- `src/app/reports/_components/reports-hub-view.tsx` (193 lines) [client]
- `src/app/reports/compliance/page.tsx` (320 lines)
- `src/app/reports/credit/page.tsx` (126 lines)
- `src/app/reports/export/route.ts` (391 lines)
- `src/app/reports/loading.tsx` (8 lines)
- `src/app/reports/page.tsx` (24 lines)
- `src/app/reports/pipeline/page.tsx` (285 lines)
- `src/app/reports/revenue/page.tsx` (278 lines)

## app/admin — 10 files, ~3254 LOC

- `src/app/admin/audit/audit-view.tsx` (688 lines) [client]
- `src/app/admin/audit/page.tsx` (102 lines)
- `src/app/admin/dashboard-view.tsx` (563 lines) [client]
- `src/app/admin/loading.tsx` (59 lines)
- `src/app/admin/master-data/page.tsx` (366 lines) [client]
- `src/app/admin/page.tsx` (65 lines)
- `src/app/admin/roles/page.tsx` (45 lines)
- `src/app/admin/roles/roles-view.tsx` (320 lines) [client]
- `src/app/admin/users/page.tsx` (46 lines)
- `src/app/admin/users/users-view.tsx` (1000 lines) [client]

## app/parties — 9 files, ~3281 LOC

- `src/app/parties/[id]/page.tsx` (857 lines)
- `src/app/parties/assign-party-form.tsx` (66 lines) [client]
- `src/app/parties/loading.tsx` (70 lines)
- `src/app/parties/new-party-dialog.tsx` (336 lines) [client]
- `src/app/parties/page.tsx` (97 lines)
- `src/app/parties/parties-list-view.tsx` (1238 lines) [client]
- `src/app/parties/party-icon.tsx` (145 lines) [client]
- `src/app/parties/party-signals.tsx` (139 lines) [client]
- `src/app/parties/relationship-graph.tsx` (333 lines) [client]

## app/portal — 9 files, ~2363 LOC

- `src/app/portal/client/[id]/page.tsx` (713 lines)
- `src/app/portal/client/client-directory-view.tsx` (323 lines) [client]
- `src/app/portal/client/loading.tsx` (43 lines)
- `src/app/portal/client/page.tsx` (42 lines)
- `src/app/portal/investor/[id]/investor-charts.tsx` (142 lines) [client]
- `src/app/portal/investor/[id]/page.tsx` (702 lines)
- `src/app/portal/investor/investor-directory-view.tsx` (313 lines) [client]
- `src/app/portal/investor/loading.tsx` (43 lines)
- `src/app/portal/investor/page.tsx` (42 lines)

## features/modeling — 9 files, ~3660 LOC

- `src/features/modeling/actions.ts` (194 lines) [server]
- `src/features/modeling/bondPricing.ts` (743 lines) [server]
- `src/features/modeling/dcf.ts` (199 lines)
- `src/features/modeling/lboModel.ts` (526 lines)
- `src/features/modeling/maModel.ts` (542 lines)
- `src/features/modeling/projectFinance.ts` (358 lines)
- `src/features/modeling/queries.ts` (241 lines)
- `src/features/modeling/scenarioAnalysis.ts` (651 lines)
- `src/features/modeling/securitization.ts` (206 lines)

## app/_components — 8 files, ~2095 LOC

- `src/app/_components/dashboard-charts-impl.tsx` (586 lines) [client]
- `src/app/_components/dashboard-charts.tsx` (96 lines) [client]
- `src/app/_components/exposure-chart-impl.tsx` (374 lines) [client]
- `src/app/_components/exposure-chart.tsx` (86 lines) [client]
- `src/app/_components/kpi-hero.tsx` (377 lines) [client]
- `src/app/_components/kpi-stat.tsx` (142 lines) [client]
- `src/app/_components/recent-activity.tsx` (273 lines) [client]
- `src/app/_components/stage-strip.tsx` (161 lines) [client]

## app/leads — 7 files, ~3081 LOC

- `src/app/leads/[id]/bant-checklist.tsx` (296 lines) [client]
- `src/app/leads/[id]/lead-workflow-actions.tsx` (416 lines) [client]
- `src/app/leads/[id]/page.tsx` (821 lines) [client]
- `src/app/leads/leads-board-view.tsx` (896 lines) [client]
- `src/app/leads/new/new-lead-form.tsx` (565 lines) [server,client]
- `src/app/leads/new/page.tsx` (48 lines)
- `src/app/leads/page.tsx` (39 lines)

## features/ai — 7 files, ~2448 LOC

- `src/features/ai/actions.ts` (44 lines) [server]
- `src/features/ai/clientInsights.ts` (455 lines)
- `src/features/ai/creditSummary.ts` (748 lines)
- `src/features/ai/index.ts` (58 lines)
- `src/features/ai/interactionSummary.ts` (493 lines)
- `src/features/ai/nextAction.ts` (450 lines)
- `src/features/ai/types.ts` (200 lines)

## app/deals — 6 files, ~3271 LOC

- `src/app/deals/[id]/page.tsx` (589 lines)
- `src/app/deals/deal-type-credit.ts` (42 lines) [client]
- `src/app/deals/deal-type-icon.tsx` (264 lines) [client]
- `src/app/deals/deals-board-view.tsx` (2266 lines) [client]
- `src/app/deals/loading.tsx` (35 lines)
- `src/app/deals/page.tsx` (75 lines)

## app/integrations — 6 files, ~1928 LOC

- `src/app/integrations/adapter-card.tsx` (934 lines) [client]
- `src/app/integrations/adapter-meta.ts` (188 lines)
- `src/app/integrations/integrations-explorer.tsx` (420 lines) [client]
- `src/app/integrations/integrations-icons.tsx` (136 lines) [client]
- `src/app/integrations/live-stat-tile.tsx` (168 lines) [client]
- `src/app/integrations/page.tsx` (82 lines)

## app/onboarding — 6 files, ~3221 LOC

- `src/app/onboarding/[id]/onboarding-detail-view.tsx` (1328 lines) [client]
- `src/app/onboarding/[id]/page.tsx` (188 lines)
- `src/app/onboarding/new/onboarding-wizard.tsx` (772 lines) [client]
- `src/app/onboarding/new/page.tsx` (22 lines)
- `src/app/onboarding/onboarding-board-view.tsx` (881 lines) [client]
- `src/app/onboarding/page.tsx` (30 lines)

## features/compliance — 6 files, ~2521 LOC

- `src/features/compliance/actions.ts` (872 lines) [server,todos:1]
- `src/features/compliance/audit.ts` (185 lines)
- `src/features/compliance/consent.ts` (185 lines) [todos:1]
- `src/features/compliance/kyc.ts` (371 lines)
- `src/features/compliance/pit.ts` (321 lines)
- `src/features/compliance/queries.ts` (587 lines)

## features/credit — 6 files, ~2136 LOC

- `src/features/credit/actions.ts` (468 lines) [server]
- `src/features/credit/queries.ts` (385 lines)
- `src/features/credit/ratingBands.ts` (79 lines)
- `src/features/credit/ratingMap.ts` (264 lines)
- `src/features/credit/ratios.ts` (478 lines)
- `src/features/credit/scorecard.ts` (462 lines)

## features/deals — 6 files, ~1590 LOC

- `src/features/deals/allocations.ts` (150 lines)
- `src/features/deals/catalog.ts` (341 lines)
- `src/features/deals/index.ts` (15 lines)
- `src/features/deals/queries.ts` (315 lines)
- `src/features/deals/roles.ts` (319 lines)
- `src/features/deals/stages.ts` (450 lines)

## features/leads — 6 files, ~2160 LOC

- `src/features/leads/actions.ts` (701 lines) [server]
- `src/features/leads/index.ts` (46 lines)
- `src/features/leads/lead-icons.tsx` (121 lines) [client]
- `src/features/leads/queries.ts` (668 lines)
- `src/features/leads/seed.ts` (359 lines)
- `src/features/leads/types.ts` (265 lines)

## features/onboarding — 6 files, ~2678 LOC

- `src/features/onboarding/actions.ts` (855 lines) [server]
- `src/features/onboarding/index.ts` (55 lines)
- `src/features/onboarding/onboarding-icons.tsx` (100 lines) [client]
- `src/features/onboarding/queries.ts` (695 lines)
- `src/features/onboarding/seed.ts` (458 lines)
- `src/features/onboarding/types.ts` (515 lines)

## app/tasks — 5 files, ~1488 LOC

- `src/app/tasks/[id]/page.tsx` (416 lines)
- `src/app/tasks/[id]/task-status-form.tsx` (81 lines) [client]
- `src/app/tasks/new-task-dialog.tsx` (376 lines) [client]
- `src/app/tasks/page.tsx` (77 lines)
- `src/app/tasks/tasks-list-view.tsx` (538 lines) [client]

## features/reports — 5 files, ~1541 LOC

- `src/features/reports/export-button.tsx` (85 lines) [client]
- `src/features/reports/export.ts` (184 lines) [todos:1]
- `src/features/reports/exportAccess.ts` (13 lines)
- `src/features/reports/index.ts` (42 lines)
- `src/features/reports/queries.ts` (1217 lines)

## features/workflow — 5 files, ~1373 LOC

- `src/features/workflow/actions.ts` (198 lines) [server,client]
- `src/features/workflow/engine.ts` (773 lines)
- `src/features/workflow/index.ts` (40 lines) [client]
- `src/features/workflow/queries.ts` (176 lines)
- `src/features/workflow/types.ts` (186 lines)

## lib — 5 files, ~581 LOC

- `src/lib/auth.ts` (287 lines) [todos:1]
- `src/lib/org.ts` (117 lines)
- `src/lib/rbac-core.ts` (17 lines)
- `src/lib/rbac.ts` (154 lines)
- `src/lib/utils.ts` (6 lines)

## app/ai — 4 files, ~873 LOC

- `src/app/ai/ai-hub-view.tsx` (485 lines) [client]
- `src/app/ai/credit-summary.tsx` (315 lines) [client]
- `src/app/ai/loading.tsx` (35 lines)
- `src/app/ai/page.tsx` (38 lines)

## app/documents — 4 files, ~1316 LOC

- `src/app/documents/[id]/page.tsx` (298 lines)
- `src/app/documents/documents-list-view.tsx` (490 lines) [client]
- `src/app/documents/new-document-dialog.tsx` (450 lines) [client]
- `src/app/documents/page.tsx` (78 lines)

## app/interactions — 4 files, ~1350 LOC

- `src/app/interactions/[id]/page.tsx` (351 lines)
- `src/app/interactions/interactions-list-view.tsx` (462 lines) [client]
- `src/app/interactions/new-interaction-dialog.tsx` (488 lines) [client]
- `src/app/interactions/page.tsx` (49 lines)

## app/matching — 4 files, ~1778 LOC

- `src/app/matching/[id]/match-matrix-view.tsx` (1005 lines) [client]
- `src/app/matching/[id]/page.tsx` (48 lines)
- `src/app/matching/matching-workspace.tsx` (669 lines) [client]
- `src/app/matching/page.tsx` (56 lines)

## features/portal — 4 files, ~1902 LOC

- `src/features/portal/index.ts` (45 lines)
- `src/features/portal/portal-charts-impl.tsx` (350 lines) [client]
- `src/features/portal/portal-charts.tsx` (55 lines) [client]
- `src/features/portal/queries.ts` (1452 lines)

## features/portfolio — 4 files, ~2019 LOC

- `src/features/portfolio/actions.ts` (161 lines) [server]
- `src/features/portfolio/index.ts` (73 lines)
- `src/features/portfolio/queries.ts` (1444 lines)
- `src/features/portfolio/risk.ts` (341 lines)

## app/login — 3 files, ~291 LOC

- `src/app/login/actions.ts` (58 lines) [server]
- `src/app/login/login-form.tsx` (127 lines) [client]
- `src/app/login/page.tsx` (106 lines)

## features/admin — 3 files, ~1222 LOC

- `src/features/admin/actions.ts` (578 lines) [server]
- `src/features/admin/index.ts` (51 lines)
- `src/features/admin/queries.ts` (593 lines)

## features/matching — 3 files, ~1817 LOC

- `src/features/matching/actions.ts` (230 lines) [server]
- `src/features/matching/engine.ts` (712 lines)
- `src/features/matching/queries.ts` (875 lines)

## features/parties — 3 files, ~1282 LOC

- `src/features/parties/actions.ts` (357 lines) [server]
- `src/features/parties/queries.ts` (762 lines)
- `src/features/parties/segmentation.ts` (163 lines)

## app/notifications — 2 files, ~712 LOC

- `src/app/notifications/notifications-center.tsx` (656 lines) [client]
- `src/app/notifications/page.tsx` (56 lines)

## features/documents — 2 files, ~525 LOC

- `src/features/documents/actions.ts` (148 lines) [server]
- `src/features/documents/queries.ts` (377 lines)

## features/interactions — 2 files, ~587 LOC

- `src/features/interactions/actions.ts` (223 lines) [server]
- `src/features/interactions/queries.ts` (364 lines)

## features/tasks — 2 files, ~586 LOC

- `src/features/tasks/actions.ts` (180 lines) [server]
- `src/features/tasks/queries.ts` (406 lines)

## app/actions — 1 files, ~10 LOC

- `src/app/actions/auth.ts` (10 lines) [server]

## app/api — 1 files, ~10 LOC

- `src/app/api/auth/[...nextauth]/route.ts` (10 lines)

## app/calendar — 1 files, ~261 LOC

- `src/app/calendar/page.tsx` (261 lines)

## app/dashboard-exposure-chart.tsx — 1 files, ~303 LOC

- `src/app/dashboard-exposure-chart.tsx` (303 lines) [client]

## app/error.tsx — 1 files, ~65 LOC

- `src/app/error.tsx` (65 lines) [client]

## app/global-error.tsx — 1 files, ~75 LOC

- `src/app/global-error.tsx` (75 lines) [client]

## app/globals.css — 1 files, ~366 LOC

- `src/app/globals.css` (366 lines)

## app/layout.tsx — 1 files, ~146 LOC

- `src/app/layout.tsx` (146 lines)

## app/loading.tsx — 1 files, ~23 LOC

- `src/app/loading.tsx` (23 lines)

## app/not-found.tsx — 1 files, ~39 LOC

- `src/app/not-found.tsx` (39 lines)

## app/page.tsx — 1 files, ~350 LOC

- `src/app/page.tsx` (350 lines)

## features/calendar — 1 files, ~243 LOC

- `src/features/calendar/queries.ts` (243 lines)

## features/dashboard — 1 files, ~530 LOC

- `src/features/dashboard/queries.ts` (530 lines)
