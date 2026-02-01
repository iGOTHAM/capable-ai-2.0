import { createHmac } from "crypto";

export interface SignedUrlPayload {
  projectId: string;
  packVersion: number;
  expiresAt: number; // Unix timestamp in seconds
}

export function generateSignedToken(
  payload: SignedUrlPayload,
  secret: string,
): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(data)
    .digest("base64url");
  return `${data}.${signature}`;
}

export function verifySignedToken(
  token: string,
  secret: string,
): SignedUrlPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [data, signature] = parts;
  if (!data || !signature) return null;

  const expectedSignature = createHmac("sha256", secret)
    .update(data)
    .digest("base64url");

  // Constant-time comparison
  if (signature.length !== expectedSignature.length) return null;
  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }
  if (mismatch !== 0) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(data, "base64url").toString("utf-8"),
    ) as SignedUrlPayload;

    // Check expiry
    if (payload.expiresAt < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}
