import type { NavIconKey } from "@/console/rbac/nav";
import {
  Gauge,
  Users,
  Handshake,
  Lightning,
  Crosshair,
  UserPlus,
  ListChecks,
  Chats,
  FileText,
  CalendarBlank,
  Bell,
  ChartBar,
  ChartPie,
  ShieldCheck,
  Calculator,
  SealCheck,
  Plugs,
  Sparkle,
  Gear,
  Building,
  UserCircle,
  Path,
  type IconProps,
} from "@phosphor-icons/react";

const map: Record<
  NavIconKey,
  React.ForwardRefExoticComponent<IconProps & React.RefAttributes<SVGSVGElement>>
> = {
  home: Gauge,
  parties: Users,
  deals: Handshake,
  leads: Lightning,
  matching: Crosshair,
  onboarding: UserPlus,
  tasks: ListChecks,
  interactions: Chats,
  documents: FileText,
  calendar: CalendarBlank,
  alerts: Bell,
  reports: ChartBar,
  portfolio: ChartPie,
  credit: ShieldCheck,
  modeling: Calculator,
  compliance: SealCheck,
  integrations: Plugs,
  ai: Sparkle,
  admin: Gear,
  investors: Building,
  clients: UserCircle,
  activity: Path,
};

export function NavIcon({
  name,
  className,
  weight = "regular",
}: {
  name: NavIconKey;
  className?: string;
  weight?: IconProps["weight"];
}) {
  const Icon = map[name] ?? Gauge;
  return <Icon className={className} weight={weight} aria-hidden />;
}
