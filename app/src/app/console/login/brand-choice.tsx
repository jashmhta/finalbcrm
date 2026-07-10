"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import type { ConsoleBrandPref } from "@/console/lib/brand-pref";
import { CONSOLE_BRAND_COOKIE } from "@/console/lib/brand-pref";
import { CButton } from "@/console/primitives/button";
import { ConsoleLoginForm } from "./login-form";

function setBrandCookie(brand: ConsoleBrandPref) {
  const maxAge = 60 * 60 * 24 * 180;
  document.cookie = `${CONSOLE_BRAND_COOKIE}=${brand}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

export function BrandChoiceLogin({
  initialBrand,
  callbackUrl,
}: {
  initialBrand: ConsoleBrandPref | null;
  callbackUrl: string;
}) {
  const router = useRouter();
  const [brand, setBrand] = useState<ConsoleBrandPref | null>(initialBrand);
  const [step, setStep] = useState<"choose" | "signin">(
    initialBrand ? "signin" : "choose",
  );

  const pick = useCallback(
    (b: ConsoleBrandPref) => {
      setBrandCookie(b);
      setBrand(b);
      setStep("signin");
      router.refresh();
    },
    [router],
  );

  if (step === "choose" || !brand) {
    return (
      <div className="space-y-4" data-brand-step="choose">
        <p className="text-center text-[13px] text-[var(--c-ink-2)]">
          Choose your desk brand to continue
        </p>
        <div className="grid gap-3">
          <button
            type="button"
            onClick={() => pick("binarycapital")}
            className="rounded-[var(--c-radius-lg)] border border-[#e8d48a] bg-gradient-to-br from-[#fffdf4] to-[#f8efd0] p-4 text-left shadow-[0_8px_24px_rgba(168,132,18,0.08)] ring-1 ring-[#c9a227]/25 transition-all hover:ring-[#c9a227]/55"
            data-brand-option="binarycapital"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8a7a40]">
              Advisory
            </p>
            <p className="mt-1 text-[16px] font-semibold text-[#1a1510]">
              Binary Capital
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-[#5c5348]">
              Coverage, mandates, credit &amp; client book — gold desk.
            </p>
          </button>
          <button
            type="button"
            onClick={() => pick("binarybonds")}
            className="rounded-[var(--c-radius-lg)] bg-[var(--c-surface)] p-4 text-left ring-1 ring-[var(--c-line-strong)] transition-all hover:ring-[var(--c-accent)] hover:shadow-[var(--c-shadow)]"
            data-brand-option="binarybonds"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--c-ink-3)]">
              Markets
            </p>
            <p className="mt-1 text-[16px] font-semibold text-[var(--c-ink)]">
              Binary Bonds
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--c-ink-2)]">
              Matching, placement pipeline &amp; markets density.
            </p>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-brand-step="signin" data-brand={brand}>
      <div className="flex items-center justify-between gap-2 rounded-[var(--c-radius)] bg-[var(--c-surface-2)] px-3 py-2">
        <p className="text-[12px] font-medium text-[var(--c-ink)]">
          {brand === "binarycapital" ? "Binary Capital" : "Binary Bonds"}
        </p>
        <CButton
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setStep("choose")}
        >
          Change brand
        </CButton>
      </div>
      <ConsoleLoginForm callbackUrl={callbackUrl} />
    </div>
  );
}
