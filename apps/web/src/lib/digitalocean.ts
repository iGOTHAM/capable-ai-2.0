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
      client_id: process.env.DO_CLIENT_ID!,
      client_secret: process.env.DO_CLIENT_SECRET!,
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
