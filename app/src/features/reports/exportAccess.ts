export interface ExportAccessSubject {
  roles?: readonly string[];
  brandScope?: "binarycapital" | "binarybonds" | "shared";
}

/**
 * CSV export is super_admin only (CEO rule).
 * Brand-scoped supers (Capital / Bonds) may export; firm-wide too.
 * Employees never export.
 */
export function canUseCsvExport(user: ExportAccessSubject | null | undefined): boolean {
  return user?.roles?.includes("super_admin") ?? false;
}
