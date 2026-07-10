"use server";

import { revalidatePath } from "next/cache";

export async function revalidateConsole(paths: string[]) {
  for (const p of paths) revalidatePath(p);
}
