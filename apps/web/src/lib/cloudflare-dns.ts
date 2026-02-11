/**
 * Cloudflare DNS management for *.capable.ai subdomains.
 *
 * Proxied mode (proxied: true) so Cloudflare terminates TLS at the edge.
 * The origin uses a self-signed cert and Caddy serves HTTPS in "Full" mode.
 * This avoids Let's Encrypt rate-limit issues from repeated rebuilds.
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
 * Deletes all existing A records for a given subdomain.
 * Prevents duplicate records when redeploying to a new IP.
 */
async function deleteExistingRecords(subdomain: string): Promise<void> {
  const { apiToken, zoneId } = getConfig();
  const name = `${subdomain}.capable.ai`;

  const res = await fetch(
    `${CF_API}/zones/${zoneId}/dns_records?type=A&name=${encodeURIComponent(name)}`,
    { headers: headers(apiToken) },
  );

  const data = (await res.json()) as {
    success: boolean;
    result?: Array<{ id: string }>;
  };

  if (!data.success || !data.result) return;

  for (const record of data.result) {
    await deleteDnsRecord(record.id);
  }
}

/**
 * Creates an A record: {subdomain}.capable.ai → IP
 * Deletes any existing A records for the subdomain first to prevent duplicates.
 * Returns the Cloudflare record ID for later updates/deletion.
 */
export async function createDnsRecord(
  subdomain: string,
  ip: string,
): Promise<string> {
  const { apiToken, zoneId } = getConfig();

  // Clean up any stale records for this subdomain before creating
  await deleteExistingRecords(subdomain);

  const res = await fetch(`${CF_API}/zones/${zoneId}/dns_records`, {
    method: "POST",
    headers: headers(apiToken),
    body: JSON.stringify({
      type: "A",
      name: `${subdomain}.capable.ai`,
      content: ip,
      ttl: 1, // Auto TTL when proxied
      proxied: true, // Cloudflare terminates TLS; origin uses self-signed cert
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
