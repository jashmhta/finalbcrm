import {
  EnvelopeSimple,
  Phone,
  WhatsappLogo,
} from "@phosphor-icons/react/ssr";

import { cn } from "@/console/lib/cn";

/** Digits only for tel / WhatsApp; keeps leading country code when present. */
export function digitsOnly(raw?: string | null): string {
  if (!raw) return "";
  return raw.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
}

export function waHref(phone?: string | null, text?: string): string | null {
  const d = digitsOnly(phone).replace(/^\+/, "");
  if (!d || d.length < 8) return null;
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${d}${q}`;
}

export function telHref(phone?: string | null): string | null {
  const d = digitsOnly(phone);
  if (!d || d.replace(/\D/g, "").length < 8) return null;
  return `tel:${d}`;
}

export function mailHref(
  email?: string | null,
  opts?: { subject?: string; body?: string },
): string | null {
  const e = (email ?? "").trim();
  if (!e || !e.includes("@")) return null;
  const params = new URLSearchParams();
  if (opts?.subject) params.set("subject", opts.subject);
  if (opts?.body) params.set("body", opts.body);
  const q = params.toString();
  return `mailto:${e}${q ? `?${q}` : ""}`;
}

export type ContactActionsProps = {
  phone?: string | null;
  email?: string | null;
  /** Prefill WhatsApp / mail subject context */
  partyName?: string | null;
  size?: "sm" | "md";
  className?: string;
  /** When true, always show disabled placeholders if channels missing */
  showEmpty?: boolean;
};

const sizeMap = {
  sm: "size-8",
  md: "size-9",
} as const;

const iconSize = { sm: 16, md: 18 } as const;

/**
 * Icon-only Call / WhatsApp / Mail quick actions.
 * Opens native handlers (tel, wa.me, mailto) — no third-party API required.
 */
export function ContactActions({
  phone,
  email,
  partyName,
  size = "md",
  className,
  showEmpty = false,
}: ContactActionsProps) {
  const subject = partyName
    ? `Binary CRM · ${partyName}`
    : "Binary CRM";
  const tel = telHref(phone);
  const wa = waHref(
    phone,
    partyName ? `Hello — reaching out regarding ${partyName}.` : undefined,
  );
  const mail = mailHref(email, { subject });

  if (!tel && !wa && !mail && !showEmpty) return null;

  const btn =
    "inline-flex items-center justify-center rounded-full ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-accent)]";
  const enabled =
    "bg-[var(--c-surface)] text-[var(--c-ink)] ring-[var(--c-line-strong)] hover:bg-[var(--c-accent-soft)] hover:text-[var(--c-accent)] hover:ring-[var(--c-accent)]";
  const disabled =
    "cursor-not-allowed bg-[var(--c-surface-2)] text-[var(--c-ink-3)] ring-[var(--c-line)] opacity-50";

  const dim = sizeMap[size];
  const is = iconSize[size];

  return (
    <div
      className={cn("inline-flex items-center gap-1.5", className)}
      role="group"
      aria-label="Contact channels"
    >
      {tel || showEmpty ? (
        tel ? (
          <a
            href={tel}
            className={cn(btn, enabled, dim)}
            title="Call"
            aria-label="Call"
          >
            <Phone size={is} weight="fill" />
          </a>
        ) : (
          <span className={cn(btn, disabled, dim)} title="No phone" aria-hidden>
            <Phone size={is} />
          </span>
        )
      ) : null}

      {wa || showEmpty ? (
        wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              btn,
              dim,
              "bg-[#25D366]/12 text-[#128C7E] ring-[#25D366]/35 hover:bg-[#25D366]/22",
            )}
            title="WhatsApp"
            aria-label="WhatsApp"
          >
            <WhatsappLogo size={is} weight="fill" />
          </a>
        ) : (
          <span className={cn(btn, disabled, dim)} title="No WhatsApp" aria-hidden>
            <WhatsappLogo size={is} />
          </span>
        )
      ) : null}

      {mail || showEmpty ? (
        mail ? (
          <a
            href={mail}
            className={cn(btn, enabled, dim)}
            title="Email"
            aria-label="Email"
          >
            <EnvelopeSimple size={is} weight="fill" />
          </a>
        ) : (
          <span className={cn(btn, disabled, dim)} title="No email" aria-hidden>
            <EnvelopeSimple size={is} />
          </span>
        )
      ) : null}
    </div>
  );
}
