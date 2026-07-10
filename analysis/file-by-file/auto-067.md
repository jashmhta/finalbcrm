
# Batch 067

## `src/db/schema/party.ts`

- **Lines:** 460 | **Bytes:** 17649
- **Kind:** Drizzle DB schema; Schema tables: party, party_type_assignment, party_identifier, address, party_duplicate_candidate
- **Header intent:** Party master + typing + canonical identifiers + address. DATA_MODEL §2.1-2.3, §2.23.9, §3 (Indian-specific fields), §1.4 (dedup). The party master is the single source of truth - no deal/contact/exposure/ credit record references free-text names; all reference party_id (§1.1).
- **Exported const:** party, partyTypeAssignment, partyIdentifier, address, partyDuplicateCandidate, partyRelations, partyTypeAssignmentRelations, partyIdentifierRelations, addressRelations, partyDuplicateCandidateRelations
- **Exported types:** Party, PartyInsert, PartyTypeAssignment, PartyTypeAssignmentInsert, PartyIdentifier, PartyIdentifierInsert, Address, AddressInsert, PartyDuplicateCandidate, PartyDuplicateCandidateInsert
- **pgTable:** party, party_type_assignment, party_identifier, address, party_duplicate_candidate
- **DB ops patterns:** where
- **Security signals:** rbac/rls, india-compliance
- **External deps:** drizzle-orm, drizzle-orm/pg-core
- **Internal imports (4):** ./enums, ./rbac, ./information_barrier, ./credit
- **Domain terms:** Party, barrier, party

## `src/db/schema/rbac.ts`

- **Lines:** 319 | **Bytes:** 11897
- **Kind:** Drizzle DB schema; Schema tables: app_user, role, permission, role_permission, user_role
- **Header intent:** RBAC - app_user, role, permission, role_permission, user_role. DATA_MODEL §2.8, §2.23.12. ARCHITECTURE §4.2: RBAC baseline + ABAC attributes (wall/compartment, mandate_id, client_id). Time-bounded roles matter because secondees and temps rotate through the credit desk.
- **Exported const:** appUser, role, permission, rolePermission, userRole, appUserRelations, roleRelations, permissionRelations, rolePermissionRelations, userRoleRelations
- **Exported types:** AppUser, AppUserInsert, Role, RoleInsert, Permission, PermissionInsert, UserRole, UserRoleInsert
- **pgTable:** app_user, role, permission, role_permission, user_role
- **DB ops patterns:** where
- **Security signals:** rbac/rls, credentials, india-compliance
- **External deps:** drizzle-orm, drizzle-orm/pg-core
- **Internal imports (3):** ./enums, ./party, ./contact
- **Domain terms:** barrier, kyc, party

## `src/db/schema/relationship.ts`

- **Lines:** 98 | **Bytes:** 3631
- **Kind:** Drizzle DB schema; Schema tables: relationship
- **Header intent:** Relationship - org hierarchy / beneficial-ownership edges (§1.5, §2.6). parent_party_id / child_party_id directed edge. relationship_type ∈ {wholly_owned, subsidiary, associate, jv, promoter, beneficial_owner, guarantor, sister_concern, management_control}. Ultimate parent is computed via a recursive CTE; party.ultimate_parent_party_id is a denormalized cache refreshed on edge change (§1.5). A beneficial_owner edge with ownership_pct >= 10 triggers EDD review (PMLA).
- **Exported const:** relationship, relationshipRelations
- **Exported types:** Relationship, RelationshipInsert
- **pgTable:** relationship
- **DB ops patterns:** where
- **Security signals:** india-compliance
- **External deps:** drizzle-orm, drizzle-orm/pg-core
- **Internal imports (3):** ./enums, ./party, ./documents
- **Domain terms:** party

## `src/db/schema/tasks.ts`

- **Lines:** 145 | **Bytes:** 4686
- **Kind:** Drizzle DB schema; Schema tables: task, task_dependency
- **Header intent:** task - standard task model (§2.19). Tasks auto-generate from deal-stage transitions (e.g., entering `rating_marketing` creates "Coordinate agency management meeting" tasks per agency). depends_on is modeled as a separate junction table (task_dependency) to preserve FK integrity - an array could not.
- **Exported const:** task, taskDependency, taskRelations, taskDependencyRelations
- **Exported types:** Task, TaskInsert, TaskDependency, TaskDependencyInsert
- **pgTable:** task, task_dependency
- **DB ops patterns:** where
- **External deps:** drizzle-orm, drizzle-orm/pg-core
- **Internal imports (4):** ./enums, ./rbac, ./party, ./deals
- **Domain terms:** party
