/** Monthly CLI request limits per subscription tier (product marketing). */
export const PI_CLI_MONTHLY_LIMIT: Record<string, number> = {
  starter: 1_000,
  pro: 10_000,
  enterprise: 100_000,
};

export function monthlyLimitForTier(tier: string | null | undefined): number {
  const t = (tier ?? "starter").toLowerCase();
  return PI_CLI_MONTHLY_LIMIT[t] ?? PI_CLI_MONTHLY_LIMIT.starter;
}
