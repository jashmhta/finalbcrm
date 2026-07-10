import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  MOBILE_NAV_HIDDEN_CLASS,
  MOBILE_NAV_IDLE_MS,
  MOBILE_NAV_ITEM_ACTIVE_CLASS,
  MOBILE_NAV_ITEM_CLASS,
  MOBILE_NAV_ROOT_CLASS,
  nextMobileNavVisible,
} from "@/console/lib/mobile-nav-scroll";

describe("nextMobileNavVisible (hide while scrolling)", () => {
  it("stays visible near the top of the desk scroll", () => {
    const r = nextMobileNavVisible({
      scrollTop: 8,
      lastScrollTop: 0,
      currentlyVisible: true,
      isScrolling: true,
    });
    expect(r.visible).toBe(true);
    expect(r.armIdleShow).toBe(false);
  });

  it("hides when scrolling the desk past the top reveal", () => {
    const r = nextMobileNavVisible({
      scrollTop: 120,
      lastScrollTop: 40,
      currentlyVisible: true,
      isScrolling: true,
    });
    expect(r.visible).toBe(false);
    expect(r.armIdleShow).toBe(true);
    expect(r.lastScrollTop).toBe(120);
  });

  it("restores visibility on idle tick after scroll", () => {
    const r = nextMobileNavVisible({
      scrollTop: 200,
      lastScrollTop: 200,
      currentlyVisible: false,
      isScrolling: false,
    });
    expect(r.visible).toBe(true);
    expect(r.armIdleShow).toBe(false);
  });

  it("hides on small downward movement when already visible mid-page", () => {
    const r = nextMobileNavVisible({
      scrollTop: 90,
      lastScrollTop: 80,
      currentlyVisible: true,
      isScrolling: true,
      thresholdPx: 4,
    });
    expect(r.visible).toBe(false);
  });

  it("exposes a positive idle restore window for UX", () => {
    expect(MOBILE_NAV_IDLE_MS).toBeGreaterThanOrEqual(150);
    expect(MOBILE_NAV_IDLE_MS).toBeLessThanOrEqual(500);
  });
});

describe("mobile liquid-glass nav shipped in shell + CSS", () => {
  it("wires circular glass classes and hide-on-scroll helper into console-shell", () => {
    const shell = readFileSync(
      resolve(process.cwd(), "src/console/shells/console-shell.tsx"),
      "utf8",
    );
    expect(shell).toContain("nextMobileNavVisible");
    // Shell imports class-name constants; either identifier or literal is fine.
    expect(
      shell.includes("MOBILE_NAV_ROOT_CLASS") || shell.includes(MOBILE_NAV_ROOT_CLASS),
    ).toBe(true);
    expect(
      shell.includes("MOBILE_NAV_HIDDEN_CLASS") || shell.includes(MOBILE_NAV_HIDDEN_CLASS),
    ).toBe(true);
    expect(
      shell.includes("MOBILE_NAV_ITEM_CLASS") || shell.includes(MOBILE_NAV_ITEM_CLASS),
    ).toBe(true);
    expect(
      shell.includes("MOBILE_NAV_ITEM_ACTIVE_CLASS") ||
        shell.includes(MOBILE_NAV_ITEM_ACTIVE_CLASS),
    ).toBe(true);
    expect(shell).toContain("c-desk-scroll");
    expect(shell).toContain('data-testid="console-mobile-nav"');
  });

  it("defines equal circular glass tokens and dock styles", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/console/tokens/shared.css"),
      "utf8",
    );
    expect(css).toContain("--c-mobile-nav-item");
    expect(css).toContain("--c-glass-fill");
    expect(css).toContain("backdrop-filter");
    expect(css).toContain(".c-mobile-nav__item");
    expect(css).toContain("border-radius: 999px");
    expect(css).toContain(".c-mobile-nav--hidden");
    expect(css).toMatch(/width:\s*var\(--c-mobile-nav-item\)/);
    expect(css).toMatch(/height:\s*var\(--c-mobile-nav-item\)/);
  });

  it("never zeros desk main padding-bottom under the glass dock", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/console/tokens/shared.css"),
      "utf8",
    );
    // The prior bug: body.console-active #main-content { padding-bottom: 0 !important }
    // Reject any rule that zeros #main-content padding-bottom with !important.
    const zeroPad =
      /body\.console-active\s+#main-content\s*\{[^}]*padding-bottom:\s*0\s*!important/;
    expect(zeroPad.test(css)).toBe(false);
    // Safe clearance for circular dock height token
    expect(css).toMatch(
      /#main-content\.c-desk-scroll[\s\S]*?padding-bottom:\s*calc\(\s*var\(--c-bottom-nav-h\)/,
    );
    expect(css).toContain("--c-bottom-nav-h");
  });
});
