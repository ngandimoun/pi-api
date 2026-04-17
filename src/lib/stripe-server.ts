import Stripe from "stripe";

let stripeSingleton: Stripe | null = null;

/** Lazy Stripe client so route modules can load during `next build` without env secrets. */
export function getStripeServer(): Stripe {
  if (!stripeSingleton) {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    stripeSingleton = new Stripe(key, { apiVersion: "2025-08-27.basil" });
  }
  return stripeSingleton;
}
