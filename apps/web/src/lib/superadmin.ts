/**
 * Superadmin detection — hardcoded email list.
 * No database schema changes needed.
 */

const SUPERADMIN_EMAILS = ["kingchih@igotham.com"];

export function isSuperAdmin(email: string): boolean {
  return SUPERADMIN_EMAILS.includes(email.toLowerCase().trim());
}
