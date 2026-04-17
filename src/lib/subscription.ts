/**
 * Whether the user has a Stripe-backed subscription that should enable CLI keys
 * (paid subscription or trial). Keep in sync with Stripe webhook `paidStatuses`.
 */
export function isPaidSubscriptionStatus(status: string | null | undefined): boolean {
  const s = (status ?? "").trim().toLowerCase();
  return s === "active" || s === "trialing";
}
