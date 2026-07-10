import { describe, expect, it } from "vitest";

import {
  adjacentSwipeHref,
  buildSwipeHrefs,
  navIndexForPath,
  swipeDirectionFromDelta,
} from "@/console/lib/mobile-nav-swipe";

describe("swipeDirectionFromDelta", () => {
  it("detects left and right past threshold", () => {
    expect(swipeDirectionFromDelta(-80, 10)).toBe("left");
    expect(swipeDirectionFromDelta(80, -5)).toBe("right");
  });

  it("ignores short or vertical pans", () => {
    expect(swipeDirectionFromDelta(-20, 0)).toBeNull();
    expect(swipeDirectionFromDelta(-80, 100)).toBeNull();
  });
});

describe("navIndexForPath + adjacentSwipeHref", () => {
  const hrefs = [
    "/console",
    "/console/parties",
    "/console/leads",
    "/console/deals",
    "/console/more",
  ];

  it("maps detail routes to parent", () => {
    expect(navIndexForPath("/console/parties/abc", hrefs)).toBe(1);
    expect(navIndexForPath("/console/leads/x", hrefs)).toBe(2);
  });

  it("swipe left goes next and wraps", () => {
    expect(adjacentSwipeHref("/console", hrefs, "left")).toBe(
      "/console/parties",
    );
    expect(adjacentSwipeHref("/console/more", hrefs, "left")).toBe("/console");
  });

  it("swipe right goes previous", () => {
    expect(adjacentSwipeHref("/console/parties", hrefs, "right")).toBe(
      "/console",
    );
  });
});

describe("buildSwipeHrefs", () => {
  it("dedupes and appends more hub", () => {
    const hrefs = buildSwipeHrefs(
      [{ href: "/console" }, { href: "/console/parties" }],
      [
        { href: "/console" },
        { href: "/console/parties" },
        { href: "/console/settings" },
      ],
    );
    expect(hrefs[0]).toBe("/console");
    expect(hrefs).toContain("/console/settings");
    expect(hrefs[hrefs.length - 1]).toBe("/console/more");
  });
});
