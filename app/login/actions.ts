"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn } from "@/lib/auth";

export type LoginState = { error?: string } | undefined;

// Credentials sign-in. `signIn` redirects to /parties on success (throws
// NEXT_REDIRECT, which Next.js turns into a 303 — we rethrow so it propagates).
// On a credentials failure it throws an AuthError, which we surface as a
// user-facing error string.
export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  try {
    await signIn("credentials", formData, { redirectTo: "/parties" });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error:
          error.type === "CredentialsSignin"
            ? "Invalid email or password."
            : "Sign-in failed. Please try again.",
      };
    }
    // Non-AuthError (e.g. NEXT_REDIRECT on success) — rethrow so the framework
    // handles the redirect.
    throw error;
  }
  // If signIn returned without redirecting (shouldn't happen with redirect:true
  // defaults), send the user to the app anyway.
  redirect("/parties");
}
