/**
 * DigitalOcean API client for droplet management.
 *
 * Uses user-provided OAuth tokens (encrypted at rest in our DB).
 * Mirrors the pattern in cloudflare-dns.ts.
 */

const DO_API = "https://api.digitalocean.com/v2";
const DO_OAUTH = "https://cloud.digitalocean.com/v1/oauth";

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface DODroplet {
  id: number;
  name: string;
  status: string; // "new" | "active" | "off" | "archive"
  networks: {
    v4: Array<{ ip_address: string; type: string }>;
  };
  region: { slug: string };
  size: { slug: string };
}

export interface DORegion {
  slug: string;
  name: string;
  available: boolean;
}

export interface DOSize {
  slug: string;
  description: string;
  memory: number; // MB
  vcpus: number;
  disk: number; // GB
  transfer: number; // TB
  price_monthly: number;
  available: boolean;
  regions: string[];
}

interface DOTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

// ─────────────────────────────────────────────
// OAuth
// ─────────────────────────────────────────────

/** Exchange an authorization code for access + refresh tokens. */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<DOTokenResponse> {
  const res = await fetch(`${DO_OAUTH}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.DO_CLIENT_ID!.trim(),
      client_secret: process.env.DO_CLIENT_SECRET!.trim(),
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DO token exchange failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<DOTokenResponse>;
}

/** Refresh an expired access token. */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<DOTokenResponse> {
  const res = await fetch(`${DO_OAUTH}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DO token refresh failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<DOTokenResponse>;
}

// ─────────────────────────────────────────────
// Account
// ─────────────────────────────────────────────

export async function getAccount(
  token: string,
): Promise<{ email: string; uuid: string }> {
  const res = await fetch(`${DO_API}/account`, { headers: headers(token) });

  if (!res.ok) {
    throw new Error(`DO get account failed (${res.status})`);
  }

  const data = (await res.json()) as { account: { email: string; uuid: string } };
  return data.account;
}

// ─────────────────────────────────────────────
// SSH Keys
// ─────────────────────────────────────────────

interface DOSshKey {
  id: number;
  fingerprint: string;
  public_key: string;
  name: string;
}

/**
 * Ensure a "capable-ai-managed" SSH key exists on the user's DO account.
 * This is a throwaway key — its only purpose is to suppress the DO password
 * email that users receive when a droplet is created without SSH keys.
 * Users never SSH into their droplets (they use the web dashboard).
 *
 * Returns the key ID, or 0 if key setup fails (droplet still creates fine,
 * user just gets the password email).
 */
async function ensureSshKey(token: string): Promise<number> {
  try {
    // Check if we already have a capable-ai key
    const listRes = await fetch(`${DO_API}/account/keys?per_page=100`, {
      headers: headers(token),
    });

    if (listRes.ok) {
      const listData = (await listRes.json()) as { ssh_keys: DOSshKey[] };
      const existing = listData.ssh_keys.find((k) => k.name === "capable-ai-managed");
      if (existing) return existing.id;
    }

    // Generate an RSA-2048 key pair. We only need the public key for DO.
    // The private key is intentionally discarded — no one SSHes into these droplets.
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"],
    );

    // Export as JWK to get raw components, then encode as OpenSSH wire format
    const jwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    const e = base64UrlToBytes(jwk.e!);
    const n = base64UrlToBytes(jwk.n!);

    // OpenSSH RSA wire format: [len "ssh-rsa"] [len e] [len n]
    const keyType = new TextEncoder().encode("ssh-rsa");
    const wireLen = 4 + keyType.length + 4 + e.length + 4 + n.length;
    const wire = new Uint8Array(wireLen);
    let offset = 0;

    function writeBytes(data: Uint8Array) {
      new DataView(wire.buffer).setUint32(offset, data.length);
      offset += 4;
      wire.set(data, offset);
      offset += data.length;
    }

    writeBytes(keyType);
    writeBytes(e);
    writeBytes(n);

    const sshPubKey = `ssh-rsa ${btoa(String.fromCharCode(...wire))} capable-ai-managed`;

    // Upload to DO
    const createRes = await fetch(`${DO_API}/account/keys`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({
        name: "capable-ai-managed",
        public_key: sshPubKey,
      }),
    });

    if (!createRes.ok) {
      console.error("Failed to create SSH key on DO account:", await createRes.text());
      return 0;
    }

    const createData = (await createRes.json()) as { ssh_key: DOSshKey };
    return createData.ssh_key.id;
  } catch (err) {
    console.error("SSH key setup failed:", err);
    return 0;
  }
}

/** Convert a base64url string to Uint8Array. */
function base64UrlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ─────────────────────────────────────────────
// Droplets
// ─────────────────────────────────────────────

interface CreateDropletParams {
  name: string;
  region: string;
  size: string;
  userData: string; // cloud-init script
}

/** Create a new droplet with cloud-init user_data. */
export async function createDroplet(
  token: string,
  params: CreateDropletParams,
): Promise<DODroplet> {
  // Ensure an SSH key exists to suppress the DO password email
  const sshKeyId = await ensureSshKey(token);

  const res = await fetch(`${DO_API}/droplets`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({
      name: params.name,
      region: params.region,
      size: params.size,
      image: "ubuntu-22-04-x64",
      user_data: params.userData,
      ipv6: true,
      monitoring: true,
      tags: ["capable-ai"],
      ...(sshKeyId ? { ssh_keys: [sshKeyId] } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DO create droplet failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { droplet: DODroplet };
  return data.droplet;
}

/** Get a droplet by its ID. */
export async function getDroplet(
  token: string,
  dropletId: string,
): Promise<DODroplet> {
  const res = await fetch(`${DO_API}/droplets/${dropletId}`, {
    headers: headers(token),
  });

  if (!res.ok) {
    throw new Error(`DO get droplet failed (${res.status})`);
  }

  const data = (await res.json()) as { droplet: DODroplet };
  return data.droplet;
}

/** Destroy a droplet. Silently succeeds if already gone (404). */
export async function destroyDroplet(
  token: string,
  dropletId: string,
): Promise<void> {
  const res = await fetch(`${DO_API}/droplets/${dropletId}`, {
    method: "DELETE",
    headers: headers(token),
  });

  if (res.status === 404) return;

  if (!res.ok) {
    throw new Error(`DO destroy droplet failed (${res.status})`);
  }
}

/** Extract the public IPv4 address from a droplet's network info. */
export function getPublicIp(droplet: DODroplet): string | null {
  const v4 = droplet.networks.v4.find((n) => n.type === "public");
  return v4?.ip_address ?? null;
}

// ─────────────────────────────────────────────
// Regions & Sizes
// ─────────────────────────────────────────────

/** List available regions. */
export async function listRegions(token: string): Promise<DORegion[]> {
  const res = await fetch(`${DO_API}/regions?per_page=50`, {
    headers: headers(token),
  });

  if (!res.ok) {
    throw new Error(`DO list regions failed (${res.status})`);
  }

  const data = (await res.json()) as { regions: DORegion[] };
  return data.regions.filter((r) => r.available);
}

/** List available sizes, filtered to affordable options. */
export async function listSizes(token: string): Promise<DOSize[]> {
  const res = await fetch(`${DO_API}/sizes?per_page=50`, {
    headers: headers(token),
  });

  if (!res.ok) {
    throw new Error(`DO list sizes failed (${res.status})`);
  }

  const data = (await res.json()) as { sizes: DOSize[] };
  // Only show sizes up to $48/mo (8GB) — larger is overkill for OpenClaw
  return data.sizes
    .filter((s) => s.available && s.price_monthly <= 48)
    .sort((a, b) => a.price_monthly - b.price_monthly);
}
