"use server";

import { signOut } from "@/lib/auth";

// Server action wrapper around Auth.js `signOut` so the client nav can call it
// via a <form action={logout}>. `signOut` clears the session cookie and
// redirects to the signIn page (configured in @/lib/auth as /login).
export async function logout(): Promise<void> {
  const dest =
    process.env.NEXT_PUBLIC_CONSOLE_DEFAULT === "1"
      ? "/console/login"
      : "/login";
  await signOut({ redirectTo: dest });
}
