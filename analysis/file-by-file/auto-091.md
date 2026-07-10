
# Batch 091

## `src/features/reports/exportAccess.ts`

- **Lines:** 13 | **Bytes:** 426
- **Kind:** Application module
- **Exported functions:** canUseCsvExport
- **Exported types:** ExportAccessSubject
- **Security signals:** rbac/rls
- **Domain terms:** binarybonds, binarycapital

## `src/features/reports/index.ts`

- **Lines:** 42 | **Bytes:** 1086
- **Kind:** Application module
- **Header intent:** Reports & Export feature barrel.
- **Security signals:** india-compliance
- **Internal imports (3):** ./queries, ./export, ./export-button

## `src/features/reports/queries.ts`

- **Lines:** 1217 | **Bytes:** 42072
- **Kind:** Feature data-access (queries)
- **Header intent:** Server-side report data access for the Reports & Export module.  These are READ-ONLY aggregate queries that power the four detail report pages (pipeline, revenue, credit, compliance) and the CSV export route. Where possible they reuse the existing feature query shapes; the aggregates themselves are raw SQL (group-by + jsonb extraction) executed via `db.execute` - the same pattern as `getDealPipeline` - because Drizzle's query builder is clumsier than SQL for GROUP BY + window + jsonb arrow extra
- **Exported functions:** getPipelineReport, getRevenueReport, getCreditReport, getComplianceReport, getReportsHubKpis, getPipelineExportRows, getRevenueExportRows, getCreditExportRows, getComplianceKycExportRows
- **Exported const:** PIPELINE_STAGE_ORDER, PIPELINE_EXPORT_COLUMNS, REVENUE_EXPORT_COLUMNS, CREDIT_EXPORT_COLUMNS, COMPLIANCE_KYC_EXPORT_COLUMNS
- **Exported types:** PipelineByStageRow, PipelineByTypeRow, PipelineByRmRow, PipelineReport, RevenueByDealRow, RevenueByMonthRow, RevenueByRmRow, RevenueReport, CreditReportRow, CreditReport, CreditReportFilter, KycStatusBreakdownRow, AuditSummaryRow, AuditEntityTypeRow, ConsentStatusRow, ComplianceReport, ReportsHubKpis, ExportColumn
- **DB ops patterns:** from
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm
- **Internal imports (3):** @/db, @/db/schema, @/lib/rbac
- **Domain terms:** BC-1, BC-6, Issuer, KYC, Scorecard, allocation, issuer, kyc, mandate, party, scorecard

## `src/features/tasks/actions.ts`

- **Lines:** 180 | **Bytes:** 5347
- **Kind:** Server Actions module; Feature mutations (actions)
- **Directive:** `use server`
- **Exported functions:** createTask, updateTaskStatus
- **Exported types:** CreateTaskState, UpdateTaskStatusState
- **Zod schemas:** createTaskSchema, updateTaskStatusSchema
- **DB ops patterns:** from, insert, returning, update, where
- **Security signals:** auth, rbac/rls
- **External deps:** drizzle-orm, next/cache, next/navigation, zod/v4
- **Internal imports (3):** @/lib/rbac, @/db/context, @/db/schema
