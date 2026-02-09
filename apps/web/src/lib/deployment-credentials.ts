/**
 * Encrypt/decrypt sensitive credentials stored in Deployment.heartbeatData.
 *
 * We store adminSecret, gatewayToken, and dashboardPassword as AES-256-GCM
 * encrypted values (using the same ENCRYPTION_KEY as DO tokens). This module
 * provides helpers to encrypt on write and decrypt on read, with backward
 * compatibility for plaintext values from existing deployments.
 *
 * Encrypted format: "iv:ciphertext:tag" (hex, 3 colon-separated parts)
 * Plaintext format: any string without exactly 2 colons in hex format
 */

import { encrypt, decrypt } from "./encryption";

/** The sensitive fields we encrypt inside heartbeatData */
const SENSITIVE_FIELDS = [
  "adminSecret",
  "dashboardPassword",
  "gatewayToken",
] as const;

type SensitiveField = (typeof SENSITIVE_FIELDS)[number];

/**
 * Check if a value looks like our encrypted format (iv:ciphertext:tag in hex).
 * This lets us be backward-compatible with existing plaintext data.
 */
function isEncrypted(value: string): boolean {
  const parts = value.split(":");
  if (parts.length !== 3) return false;
  // All parts should be hex strings
  return parts.every((part) => /^[0-9a-f]+$/i.test(part));
}

/**
 * Decrypt a credential value. If it's already plaintext (from before
 * encryption was added), return it as-is.
 */
export function decryptCredential(value: string): string {
  if (!value) return value;
  try {
    if (isEncrypted(value)) {
      return decrypt(value);
    }
    // Plaintext — return as-is for backward compatibility
    return value;
  } catch {
    // If decryption fails, it might be a plaintext value that happens to look
    // like encrypted format. Return as-is rather than throwing.
    return value;
  }
}

/**
 * Encrypt sensitive fields in heartbeatData before writing to the database.
 * Non-sensitive fields are passed through unchanged.
 */
export function encryptHeartbeatCredentials(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...data };
  for (const field of SENSITIVE_FIELDS) {
    const value = result[field];
    if (typeof value === "string" && value.length > 0) {
      // Only encrypt if not already encrypted (idempotent)
      if (!isEncrypted(value)) {
        result[field] = encrypt(value);
      }
    }
  }
  return result;
}

/**
 * Read heartbeatData from a deployment and decrypt the sensitive credential
 * fields. Returns null for any missing fields.
 */
export function getDecryptedCredentials(
  heartbeatData: Record<string, unknown> | null | undefined,
): {
  adminSecret: string | null;
  dashboardPassword: string | null;
  gatewayToken: string | null;
} {
  if (!heartbeatData) {
    return { adminSecret: null, dashboardPassword: null, gatewayToken: null };
  }

  const adminSecret =
    typeof heartbeatData.adminSecret === "string"
      ? decryptCredential(heartbeatData.adminSecret)
      : null;

  const dashboardPassword =
    typeof heartbeatData.dashboardPassword === "string"
      ? decryptCredential(heartbeatData.dashboardPassword)
      : null;

  const gatewayToken =
    typeof heartbeatData.gatewayToken === "string"
      ? decryptCredential(heartbeatData.gatewayToken)
      : null;

  return { adminSecret, dashboardPassword, gatewayToken };
}
