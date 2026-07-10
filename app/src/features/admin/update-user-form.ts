/**
 * Pure FormData parsing for updateUser — omit-if-absent multi-value fields.
 * Kept outside the "use server" module so unit tests can import without RSC.
 */

export function parseUpdateUserFormFields(formData: FormData): {
  userId: FormDataEntryValue | null;
  desk: string | undefined;
  isActive: string | undefined;
  password: string;
  /** undefined = do not sync roles; array (possibly empty) = replace grants */
  roleNames: string[] | undefined;
  /** undefined = do not touch barriers; array = set barriers */
  barrierClearance: string[] | undefined;
} {
  // Prefer explicit sentinels (console password-safe). Also accept legacy
  // desk-edit forms that already emit roleNames / barrierClearance fields.
  const wantsRoles =
    formData.has("rolesSync") || formData.has("roleNames");
  const wantsBarriers =
    formData.has("barriersSync") || formData.has("barrierClearance");
  return {
    userId: formData.get("userId"),
    desk: (formData.get("desk") as string | null) || undefined,
    isActive: (formData.get("isActive") as string | null) || undefined,
    password: (formData.get("password") as string | null) || "",
    roleNames: wantsRoles
      ? formData
          .getAll("roleNames")
          .map((v) => String(v))
          .filter(Boolean)
      : undefined,
    barrierClearance: wantsBarriers
      ? formData
          .getAll("barrierClearance")
          .map((v) => String(v))
          .filter(Boolean)
      : undefined,
  };
}
