"use server";

import { AuthError } from "next-auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { z } from "zod/v4";

import { signIn } from "@/lib/auth";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .pipe(z.email("Enter a valid email address.")),
  password: z.string().min(1, "Password is required."),
  totp: z.string().optional(),
  callbackUrl: z.string().optional(),
});

export type ConsoleLoginState = { error?: string } | undefined;

export async function consoleLogin(
  _prev: ConsoleLoginState,
  formData: FormData,
): Promise<ConsoleLoginState> {
  const rawEmail = String(formData.get("email") ?? "");
  const rawPassword = String(formData.get("password") ?? "");
  const rawTotp = String(formData.get("totp") ?? "").trim();
  const rawCallback = String(formData.get("callbackUrl") ?? "");

  const parsed = loginSchema.safeParse({
    email: rawEmail,
    password: rawPassword,
    totp: rawTotp || undefined,
    callbackUrl: rawCallback || undefined,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Please check your details.",
    };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const password = parsed.data.password;
  const totp = parsed.data.totp;
  const callbackUrl = parsed.data.callbackUrl;
  const redirectTo =
    callbackUrl && callbackUrl.startsWith("/console")
      ? callbackUrl
      : "/console";

  try {
    await signIn("credentials", {
      email,
      password,
      ...(totp ? { totp } : {}),
      redirectTo,
    });
    // signIn with redirect never returns on success
    return undefined;
  } catch (err) {
    // Successful Auth.js sign-in throws a Next.js redirect — must rethrow.
    if (isRedirectError(err)) throw err;

    const dig =
      err && typeof err === "object"
        ? (err as { type?: string; message?: string; cause?: unknown })
        : null;

    if (
      err instanceof AuthError ||
      dig?.type === "CredentialsSignin" ||
      dig?.type === "CallbackRouteError"
    ) {
      return {
        error:
          "Invalid email or password. Demo password is BinaryCrm!2026 (leave authenticator blank).",
      };
    }

    console.error("[consoleLogin] unexpected", dig?.type ?? dig?.message ?? err);
    return {
      error:
        "Sign-in failed. Open http://20.161.68.148:3000/console/login and use BinaryCrm!2026.",
    };
  }
}
