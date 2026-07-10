export interface RbacSubject {
  roles?: string[];
  permissions: Set<string>;
}

export function can(
  user: RbacSubject | null | undefined,
  action: string,
  resource: string,
): boolean {
  if (!user) return false;
  if (user.roles?.includes("admin") || user.roles?.includes("super_admin")) {
    return true;
  }
  return user.permissions.has(`${resource}:${action}`);
}

