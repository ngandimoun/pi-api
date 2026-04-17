import { PI_CLI_DEFAULT_PRICE_IDS } from "@/lib/pi-cli-stripe-prices";

/**
 * Reject empty strings, obvious .env placeholders, and non–price_ IDs so we never call
 * the billing provider with invalid IDs (e.g. price_starter_placeholder).
 */
export function isUsableStripePriceId(priceId: string | undefined | null): boolean {
  const s = (priceId ?? "").trim();
  if (!s.startsWith("price_")) return false;
  if (s.length < 20) return false;
  if (/placeholder|changeme|your_price|example|_placeholder$/i.test(s)) return false;
  return true;
}

const TIER_KEYS = ["starter", "pro", "enterprise"] as const;
export type SubscriptionTierId = (typeof TIER_KEYS)[number];

/**
 * Prefer `STRIPE_PRICE_ID_*`, then `NEXT_PUBLIC_STRIPE_PRICE_ID_*`, then bundled Pi CLI
 * defaults from `pi-cli-stripe-prices.ts` (same Stripe product the repo was provisioned with).
 */
export function resolvePriceIdForTier(tier: string): string | undefined {
  const t = tier.toLowerCase();
  if (!(TIER_KEYS as readonly string[]).includes(t)) return undefined;

  const serverFirst: Record<SubscriptionTierId, [string | undefined, string | undefined]> = {
    starter: [process.env.STRIPE_PRICE_ID_STARTER, process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_STARTER],
    pro: [process.env.STRIPE_PRICE_ID_PRO, process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO],
    enterprise: [
      process.env.STRIPE_PRICE_ID_ENTERPRISE,
      process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_ENTERPRISE,
    ],
  };

  const [a, b] = serverFirst[t as SubscriptionTierId];
  if (isUsableStripePriceId(a)) return a!.trim();
  if (isUsableStripePriceId(b)) return b!.trim();

  const fallback = PI_CLI_DEFAULT_PRICE_IDS[t as SubscriptionTierId];
  if (isUsableStripePriceId(fallback)) return fallback;

  return undefined;
}
