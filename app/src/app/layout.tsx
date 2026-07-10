import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteNav } from "@/components/site-nav";
import { Toaster } from "@/components/ui/sonner";
import { PageTransition } from "@/components/brand/page-transition";
import { auth } from "@/lib/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://binarycapital.in";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Binary CRM",
    template: "%s · Binary CRM",
  },
  description:
    "Relationship, deal, and credit-analysis CRM for Binary Capital Advisors LLP and the Binary Bonds division.",
  formatDetection: { telephone: false, email: false, address: false },
  applicationName: "Binary CRM",
  referrer: "origin-when-cross-origin",
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any" }],
    shortcut: ["/favicon.ico"],
    apple: [{ url: "/favicon.ico", sizes: "any" }],
  },
  openGraph: {
    title: "Binary CRM",
    description:
      "Relationship, deal, and credit-analysis CRM for Binary Capital Advisors LLP and the Binary Bonds division.",
    url: siteUrl,
    siteName: "Binary Capital",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "Binary Capital logo",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Binary CRM",
    description:
      "Relationship, deal, and credit-analysis CRM for Binary Capital Advisors LLP and the Binary Bonds division.",
    images: ["/logo.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#f6f9fc",
};

// Default sidebar width as a CSS var on <html>. The desktop SiteNav sidebar
// consumes it (width: var(--sidebar-w)) AND the body's `md:pl-[var(--sidebar-w)]`
// consumes it, so the fixed sidebar and the main-content offset are literally
// the same value and can never drift. A no-flash inline script (below) overrides
// it pre-hydration from localStorage so a reload paints the user's last
// collapse state immediately; this inline default is the fallback if that
// script is blocked (privacy mode / disabled JS). Cast because CSSProperties
// does not statically include custom property keys.
const htmlStyle = {
  "--sidebar-w": "16rem",
} as React.CSSProperties;

// Pre-hydration no-flash script: reads the sidebar collapse preference from
// localStorage and sets `--sidebar-w` on <html> before React paints, so the
// very first frame is already at the user's last width (expanded 16rem or
// collapsed 4rem). Without this, a reload would paint expanded for one frame
// then snap to collapsed for users who left it collapsed. Mirrors the
// next-themes no-flash pattern. Runs synchronously during parse (top of body).
const SIDEBAR_NOFLASH_SCRIPT = `(function(){try{var c=localStorage.getItem('sidebar-collapsed')==='1';document.documentElement.style.setProperty('--sidebar-w',c?'4rem':'16rem');}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Load the session in the root layout so the nav can show the signed-in user.
  // `auth()` reads the JWT cookie (request-time API) → the layout is dynamic,
  // which is correct for a CRM (no static shell). On /login and /console the
  // SiteNav hides itself; /console provides its own shell + padding.
  const session = await auth();
  const { headers } = await import("next/headers");
  const h = await headers();
  // next-url / x-url may be absent; pathname for chrome opt-out is also done
  // client-side in SiteNav. Body pad is zeroed when console is detected via
  // a lightweight header or we rely on console shell's own layout.
  // Use x-invoke-path when present (Vercel/Next), else default pad (SiteNav null
  // still leaves pad - fixed below by not padding when children are console).
  // Practical approach: always set pad via CSS class controlled by client
  // ConsoleBodyReset on /console routes.
  const pathGuess =
    h.get("x-pathname") ||
    h.get("x-matched-path") ||
    h.get("next-url") ||
    h.get("x-url") ||
    "";
  // Dual frontend: /console/* owns chrome + scroll; do not nest another <main>.
  const isConsole =
    pathGuess === "/console" ||
    pathGuess.startsWith("/console/") ||
    pathGuess.includes("/console");

  return (
    <html
      lang="en"
      suppressHydrationWarning
      style={htmlStyle}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        className={
          isConsole
            ? // Lock viewport height so console shell main can own overflow-y.
              "relative flex h-dvh max-h-dvh flex-col overflow-hidden bg-background text-foreground"
            : "relative flex min-h-[100dvh] flex-col bg-background text-foreground md:pl-[var(--sidebar-w)]"
        }
      >
        <script dangerouslySetInnerHTML={{ __html: SIDEBAR_NOFLASH_SCRIPT }} />
        {!isConsole ? (
          <a
            href="#main-content"
            className="sr-only z-[100] rounded-md bg-gold px-4 py-2 text-[13px] font-medium text-on-gold shadow-floating focus:not-sr-only focus:fixed focus:left-1/2 focus:top-4 focus:-translate-x-1/2 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
          >
            Skip to content
          </a>
        ) : null}
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          forcedTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <SiteNav
            user={
              session?.user
                ? {
                    email: session.user.email,
                    name: session.user.name,
                    roles: session.user.roles ?? null,
                  }
                : null
            }
          />
          {isConsole ? (
            // Console shell provides #main-content + scroll region.
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {children}
            </div>
          ) : (
            <main
              id="main-content"
              className="relative flex flex-1 flex-col pb-24 md:pb-0"
            >
              <PageTransition>{children}</PageTransition>
            </main>
          )}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
