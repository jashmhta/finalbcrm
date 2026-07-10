import { cookies } from "next/headers";

import { ConsoleShell } from "@/console/shells/console-shell";
import { buildConsoleNav, resolveConsoleBrand } from "@/console/rbac/nav";
import {
  CONSOLE_BRAND_COOKIE,
  parseBrandPref,
} from "@/console/lib/brand-pref";
import { requireUser } from "@/lib/rbac";
import { getBellData } from "@/features/workflow/actions";

export const dynamic = "force-dynamic";

export default async function ConsoleDeskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const jar = await cookies();
  const brandPref = parseBrandPref(jar.get(CONSOLE_BRAND_COOKIE)?.value);
  const brand = resolveConsoleBrand({
    brandScope: user.brandScope,
    roles: user.roles,
    brandPref,
  });
  const nav = buildConsoleNav({
    roles: user.roles,
    permissions: user.permissions,
    brandScope: user.brandScope,
    brandPref,
  });

  let unreadCount = 0;
  try {
    const bell = await getBellData(1);
    unreadCount = bell.unreadCount;
  } catch {
    unreadCount = 0;
  }

  return (
    <ConsoleShell
      brand={brand}
      nav={nav}
      unreadCount={unreadCount}
      user={{
        name: user.name,
        email: user.email,
        roles: user.roles,
        desk: user.desk,
      }}
    >
      {children}
    </ConsoleShell>
  );
}
