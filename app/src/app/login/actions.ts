"use server";

// Login server action. Validates credentials with zod, then delegates to
// Auth.js `signIn("credentials", …)`. On success `signIn` throws a
// NEXT_REDIRECT (caught by Next's server-action machinery) that lands the user
// on `redirectTo` (the callbackUrl they came from, or /parties). On a
// credentials failure Auth.js throws an `AuthError`, which we surface as a
// generic form error - never leak whether the email exists.

import { AuthError } from "next-auth";
import { z } from "zod/v4";

import { signIn } from "@/lib/auth";

const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
  callbackUrl: z.string().optional(),
});

export type LoginState = { error?: string } | undefined;

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    callbackUrl: formData.get("callbackUrl") || undefined,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Please check your details.",
    };
  }

  const { email, password, callbackUrl } = parsed.data;

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/parties",
    });
    // signIn throws NEXT_REDIRECT on success, so this line is unreachable in
    // the happy path. Return a no-op state for type completeness.
    return undefined;
  } catch (err) {
    // AuthError → bad credentials / provider config issue → user-facing error.
    if (err instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    // Anything else (e.g. NEXT_REDIRECT) MUST propagate so Next can handle it.
    throw err;
  }
}
