/**
 * Cloudflare DNS management for *.capable.ai subdomains.
 *
 * DNS-only mode (proxied: false) so Let's Encrypt HTTP-01 challenge
 * works directly on the user's droplet via Caddy.
 */

const CF_API = "https://api.cloudflare.com/client/v4";

function getConfig() {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;

  if (!apiToken || !zoneId) {
    throw new Error(
      "Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID environment variables",
    );
  }

  return { apiToken, zoneId };
}

function headers(apiToken: string) {
  return {
    Authorization: `Bearer ${apiToken}`,
    "Content-Type": "application/json",
  };
}

interface CloudflareResult {
  success: boolean;
  result?: { id: string };
  errors?: Array<{ code: number; message: string }>;
}

/**
 * Creates an A record: {subdomain}.capable.ai → IP
 * Returns the Cloudflare record ID for later updates/deletion.
 */
export async function createDnsRecord(
  subdomain: string,
  ip: string,
): Promise<string> {
  const { apiToken, zoneId } = getConfig();

  const res = await fetch(`${CF_API}/zones/${zoneId}/dns_records`, {
    method: "POST",
    headers: headers(apiToken),
    body: JSON.stringify({
      type: "A",
      name: `${subdomain}.capable.ai`,
      content: ip,
      ttl: 60, // 1 minute — fast propagation for new deployments
      proxied: false, // DNS-only so Let's Encrypt HTTP-01 works on the droplet
    }),
  });

  const data = (await res.json()) as CloudflareResult;

  if (!data.success || !data.result?.id) {
    const errMsg =
      data.errors?.map((e) => e.message).join(", ") ?? "Unknown error";
    throw new Error(`Cloudflare DNS create failed: ${errMsg}`);
  }

  return data.result.id;
}

/**
 * Updates an existing A record to point to a new IP.
 */
export async function updateDnsRecord(
  recordId: string,
  ip: string,
): Promise<void> {
  const { apiToken, zoneId } = getConfig();

  const res = await fetch(
    `${CF_API}/zones/${zoneId}/dns_records/${recordId}`,
    {
      method: "PATCH",
      headers: headers(apiToken),
      body: JSON.stringify({
        content: ip,
      }),
    },
  );

  const data = (await res.json()) as CloudflareResult;

  if (!data.success) {
    const errMsg =
      data.errors?.map((e) => e.message).join(", ") ?? "Unknown error";
    throw new Error(`Cloudflare DNS update failed: ${errMsg}`);
  }
}

/**
 * Deletes an A record by its Cloudflare record ID.
 * Silently succeeds if the record is already gone (404).
 */
export async function deleteDnsRecord(recordId: string): Promise<void> {
  const { apiToken, zoneId } = getConfig();

  const res = await fetch(
    `${CF_API}/zones/${zoneId}/dns_records/${recordId}`,
    {
      method: "DELETE",
      headers: headers(apiToken),
    },
  );

  // 404 = already deleted, treat as success
  if (res.status === 404) return;

  const data = (await res.json()) as CloudflareResult;

  if (!data.success) {
    const errMsg =
      data.errors?.map((e) => e.message).join(", ") ?? "Unknown error";
    throw new Error(`Cloudflare DNS delete failed: ${errMsg}`);
  }
}
