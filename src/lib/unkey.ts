import { Unkey } from "@unkey/api";

/**
 * Build a server-side Unkey client using environment variables.
 * Keep this module server-only and never expose root credentials client-side.
 */
export function getUnkeyClient(): Unkey {
  const rootKey = process.env.UNKEY_ROOT_KEY;

  if (!rootKey) {
    throw new Error("Missing UNKEY_ROOT_KEY");
  }

  return new Unkey({
    rootKey,
  });
}

/**
 * Verify a Pi API key against Unkey.
 */
export async function verifyUnkeyApiKey(apiKey: string) {
  const client = getUnkeyClient();

  return client.keys.verifyKey({
    key: apiKey,
  });
}
