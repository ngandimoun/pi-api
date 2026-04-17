/**
 * Canonical Pi CLI subscription product on Stripe (product `prod_ULfdRvppHu9wgT`).
 * Monthly USD: Starter $5, Pro $17, Enterprise $49.
 *
 * Used as a last resort when `STRIPE_PRICE_ID_*` / `NEXT_PUBLIC_STRIPE_PRICE_ID_*` are unset,
 * so local checkout works with the same Stripe account that minted these prices.
 * Override with env vars if you use a different Stripe account or prices.
 */
export const PI_CLI_STRIPE_PRODUCT_ID = "prod_ULfdRvppHu9wgT" as const;

export const PI_CLI_DEFAULT_PRICE_IDS = {
  starter: "price_1TMyIWLSkpLnDR0lYmLP2tXs",
  pro: "price_1TMyIWLSkpLnDR0lkVNgY7d0",
  enterprise: "price_1TMyIWLSkpLnDR0l7EQh5jbm",
} as const;
