import { describe, expect, it } from "vitest";

import {
  digitsOnly,
  mailHref,
  telHref,
  waHref,
} from "@/console/primitives/contact-actions";

describe("contact action href builders", () => {
  it("normalizes phone digits", () => {
    expect(digitsOnly("+91-98 765 43210")).toBe("+919876543210");
    expect(digitsOnly(null)).toBe("");
  });

  it("builds tel and WhatsApp links", () => {
    expect(telHref("+91 9876543210")).toBe("tel:+919876543210");
    expect(waHref("9876543210")).toBe("https://wa.me/9876543210");
    expect(waHref("12")).toBeNull();
  });

  it("builds mailto with optional subject", () => {
    expect(mailHref("rm@binarycapital.in", { subject: "Hello" })).toBe(
      "mailto:rm@binarycapital.in?subject=Hello",
    );
    expect(mailHref("not-an-email")).toBeNull();
  });
});
