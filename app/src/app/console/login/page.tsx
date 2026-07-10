import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import logoSrc from "@/components/logo.png";
import { auth } from "@/lib/auth";
import {
  CONSOLE_BRAND_COOKIE,
  parseBrandPref,
} from "@/console/lib/brand-pref";
import { BrandChoiceLogin } from "./brand-choice";

import "@/console/tokens/shared.css";
import "@/console/tokens/capital.css";
import "@/console/tokens/bonds.css";
import "@/console/tokens/firm.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  title: "Console · Capital or Bonds",
  description: "Choose Binary Capital or Binary Bonds, then sign in",
};

export default async function ConsoleLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  if (session?.user?.appUserId) {
    redirect("/console");
  }
  const sp = await searchParams;
  const callbackUrl =
    sp.callbackUrl && sp.callbackUrl.startsWith("/console")
      ? sp.callbackUrl
      : "/console";

  const jar = await cookies();
  const brandPref = parseBrandPref(jar.get(CONSOLE_BRAND_COOKIE)?.value);
  const dataBrand = brandPref ?? "shared";

  return (
    <div
      className="console-root flex h-dvh max-h-dvh flex-col items-center justify-center overflow-y-auto overscroll-y-contain px-4 py-10"
      data-brand={dataBrand}
    >
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex size-12 items-center justify-center overflow-hidden rounded-2xl bg-[var(--c-surface)] shadow-[var(--c-shadow)] ring-1 ring-[var(--c-line)]">
            <Image
              src={logoSrc}
              alt="Binary"
              width={40}
              height={40}
              priority
              className="object-contain p-1"
            />
          </span>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--c-ink-3)]">
            Binary CRM
          </p>
          <h1 className="mt-2 text-[1.5rem] font-semibold tracking-tight text-[var(--c-ink)]">
            Sign in to your desk
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--c-ink-2)]">
            Choose <strong>Binary Capital</strong> or{" "}
            <strong>Binary Bonds</strong>, then enter your work email and
            password.
          </p>
        </div>

        <div className="rounded-[var(--c-radius-lg)] bg-[var(--c-surface)] p-6 shadow-[var(--c-shadow)] ring-1 ring-[var(--c-line)] md:p-7">
          <BrandChoiceLogin
            initialBrand={brandPref}
            callbackUrl={callbackUrl}
          />
        </div>
      </div>
    </div>
  );
}
