import "@/console/tokens/shared.css";
import "@/console/tokens/capital.css";
import "@/console/tokens/bonds.css";
import "@/console/tokens/firm.css";

/**
 * Console root layout - tokens only.
 * Authenticated chrome lives in (desk)/layout.tsx so /console/login stays bare.
 */
export default function ConsoleRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
